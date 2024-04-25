var rowCount = 1; // Global declaration of rowCount
var elevationData = {}; // Elevation data parsed from Excel

document.addEventListener('DOMContentLoaded', function() {
    attachInitialEventListeners();
    document.getElementById('addRowButton').addEventListener('click', addRow);
    document.getElementById('elevationFile').addEventListener('change', handleFileUpload);
});

function convertUnits(value, fromUnit, toUnit) {
    if (!value) return 0;
    switch (fromUnit) {
        case 'meters':
            return toUnit === 'feet' ? value * 3.28084 : value;
        case 'feet':
            return toUnit === 'meters' ? value / 3.28084 : value;
        case 'millimeters':
            return toUnit === 'inches' ? value / 25.4 : value;
        case 'inches':
            return toUnit === 'millimeters' ? value * 25.4 : value;
        case 'm3min':
            return toUnit === 'm3sec' ? value / 60 : value;
        case 'usgpm':
            return toUnit === 'm3sec' ? value * 0.0000630902 : value;
        default:
            return value;
    }
}

function attachInitialEventListeners() {
    const initialRow = document.querySelector('#pumpTableBody tr');
    if (initialRow) {
        attachEventListeners(initialRow);
    }
}

function attachEventListeners(row) {
    const inputs = row.querySelectorAll('input[type="number"], select');
    inputs.forEach(input => {
        input.addEventListener('input', () => handleInputChange(row));
    });
}

function handleInputChange(row) {
    updateCalculations(row);
}

function updateCalculations(row) {
    console.log(`Updating calculations for row ${row.id}`);

    const fromInput = row.querySelector(`input[name^="from-"]`);
    const toInput = row.querySelector(`input[name^="to-"]`);

    // Check if inputs exist before proceeding
    if (!fromInput || !toInput) {
        console.error('From or to input not found in the row:', row);
        return;
    }

    const flowRate = parseFloat(row.querySelector(`input[name^="flowRate-"]`).value) || 0;
    const from = parseFloat(fromInput.value) || 0;
    const to = parseFloat(toInput.value) || 0;
    console.log(`From: ${from}, To: ${to}`);
    const diameter = parseFloat(row.querySelector(`input[name^="pipeDiameter-"]`).value) || 0;
    const frictionCoefficient = parseFloat(row.querySelector(`input[name^="lineFriction-"]`).value) || 0;

    const distance = to - from;
    row.querySelector(`input[name^="distance-"]`).value = distance.toFixed(2);

    console.log(`Flow rate: ${flowRate}, From: ${from}, To: ${to}, Distance: ${distance}`);

    const flowRateUnit = row.querySelector(`select[name^="flowRateUnit-"]`).value;
    const diameterUnit = row.querySelector(`select[name^="pipeDiameterUnit-"]`).value;

    const convertedFlowRate = convertUnits(flowRate, flowRateUnit, 'm3sec');
    const convertedDiameter = convertUnits(diameter, diameterUnit, 'millimeters');

    const frictionHeadLoss = calculateFrictionLoss(convertedFlowRate, distance, convertedDiameter, frictionCoefficient);
    const frictionHeadLossElement = row.querySelector(`td[id^="frictionHeadLoss-"]`);
    if (frictionHeadLossElement) {
        frictionHeadLossElement.textContent = `${frictionHeadLoss.toFixed(2)} m`;
    } else {
        console.error('Friction head loss element not found in the row:', row);
    }

    // Get elevation at 'from' and 'to' distances
    const elevationFrom = findNearestElevation(from);
    const elevationTo = findNearestElevation(to);

    const elevationHead = elevationTo - elevationFrom;
    const elevationHeadElement = row.querySelector(`td[id^="elevationHead-"]`);
    if (elevationHeadElement) {
        elevationHeadElement.textContent = `${elevationHead.toFixed(2)} m`;
    } else {
        console.error('Elevation head element not found in the row:', row);
    }

    const totalHead = frictionHeadLoss + elevationHead;
    const totalHeadElement = row.querySelector(`td[id^="totalHead-"]`);
    if (totalHeadElement) {
        totalHeadElement.textContent = `${totalHead.toFixed(2)} m`;
    } else {
        console.error('Total head element not found in the row:', row);
    }

    const pumpTDHInput = row.querySelector(`input[name^="pumpTDH-"]`);
    const pumpTDH = parseFloat(pumpTDHInput.value) || 0;
    console.log(`Pump TDH for row ${row.id}: ${pumpTDH}`);

    let npshd = 0;
    if (row.id === 'row-1') {
        // For the first row, NPSHD is calculated without considering the previous row
        npshd = pumpTDH - totalHead;
    } else {
      // For subsequent rows, NPSHD includes the NPSHD of the previous row
      const previousRow = document.getElementById(`row-${parseInt(row.id.split('-')[1]) - 1}`);
      const previousNPSHD = parseFloat(previousRow.querySelector(`td[id^="npshd-"]`).textContent.split(' ')[0]) || 0;
      console.log(`Previous NPSHD for row ${row.id}: ${previousNPSHD}`);
      npshd = previousNPSHD + pumpTDH - totalHead;
      console.log(`NPSHD calculation for row ${row.id}: ${npshd}`);
  }


    const npshdElement = row.querySelector(`td[id^="npshd-"]`);
    if (npshdElement) {
        npshdElement.textContent = `${npshd.toFixed(2)} ft`;
    } else {
        console.error('NPSHD element not found in the row:', row);
    }

    console.log(`NPSHD for row ${row.id}: ${npshd}`);
    console.log(`Total head: ${totalHead}, NPSHD: ${npshd}`);
}


function findNearestElevation(distance) {
    console.log("Searching for elevation at distance:", distance);

    // Check if elevation data exists for the given distance
    if (elevationData.hasOwnProperty(distance)) {
        console.log("Elevation found at exact distance:", elevationData[distance]);
        return elevationData[distance];
    }

    // Find the nearest elevation
    let nearestDistance = null;
    let nearestElevation = null;
    Object.keys(elevationData).forEach(key => {
        const currentDistance = parseFloat(key);
        if (nearestDistance === null || Math.abs(currentDistance - distance) < Math.abs(nearestDistance - distance)) {
            nearestDistance = currentDistance;
            nearestElevation = elevationData[key];
        }
    });

    console.log("Nearest elevation found at distance:", nearestDistance, "with elevation:", nearestElevation);
    return nearestElevation;
}

function calculateFrictionLoss(flowRate, length, diameter, frictionCoefficient) {
    const diameterMeters = diameter / 1000;
    return 10.67 * (Math.pow(flowRate, 1.852) * length) / (Math.pow(diameterMeters, 4.8704) * Math.pow(frictionCoefficient, 1.852));
}

function addRow() {
    const tableBody = document.getElementById('pumpTableBody');
    const newRow = tableBody.rows[0].cloneNode(true);
    rowCount++;
    newRow.id = 'row-' + rowCount;
    newRow.querySelectorAll('input, select').forEach(element => {
        const baseName = element.name.split('-')[0];
        element.name = baseName + '-' + rowCount;
        element.id = baseName + '-' + rowCount;
        element.setAttribute('data-row', rowCount);
        if (element.type !== 'button') {
            element.value = '';
        }
        if (element.tagName.toLowerCase() === 'select') {
            element.selectedIndex = 0;
        }
    });
    tableBody.appendChild(newRow);
    attachEventListeners(newRow);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        parseElevationData(json); // Parse elevation data
        determineAxisLimits(); // Determine axis limits

        // Draw the main line graph
        plotMainLineGraph();

        // Draw visual lines
        const canvas = document.getElementById('mainLineGraph');
        const ctx = canvas.getContext('2d');
        
        drawVisualLines(ctx);
    };
    reader.readAsArrayBuffer(file);
}
  function determineAxisLimits() {
    const lineDistances = Object.keys(elevationData).map(Number);
    const elevations = Object.values(elevationData);

    const minX = Math.min(...lineDistances);
    const maxX = Math.max(...lineDistances);
    const minY = Math.min(...elevations);
    const maxY = Math.max(...elevations);

   //  some padding to the limits for better visualization
    const paddingX = (maxX - minX) * 0.1; // 10% padding
    const paddingY = (maxY - minY) * 0.1; // 10% padding

    // Define axis limits
    const xAxisLimits = [minX - paddingX, maxX + paddingX];
    const yAxisLimits = [minY - paddingY, maxY + paddingY];
  } 
function parseElevationData(data) {
    elevationData = {};
    data.forEach(row => {
        const lineDistance = parseInt(row['Line Distance']); // Convert to integer
        elevationData[lineDistance] = parseFloat(row.Elevation);
    });
    console.log("Elevation data loaded:", elevationData);
}
let mainLineChart; // Global variable to store the Chart instance

function plotMainLineGraph() {
    const canvas = document.getElementById('mainLineGraph');
    canvas.width = 800; // Set the width to your desired value
    canvas.height = 400; // Set the height to your desired value
    const ctx = canvas.getContext('2d');

    // Destroy existing Chart instance if it exists
    if (mainLineChart) {
        mainLineChart.destroy();
    }

    const lineDistances = Object.keys(elevationData).map(Number);
    const elevations = Object.values(elevationData);

    mainLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: lineDistances,
            datasets: [{
                label: 'Elevation vs Line Distance',
                data: elevations,
                borderColor: 'black',
                borderWidth: 2,
                pointRadius: 0, // Remove data points
                pointHoverRadius: 0, // Remove data points hover radius
                fill: false,
            }]
        },
        options: {
            responsive: false, // Disable automatic resizing
            maintainAspectRatio: false, // Disable maintaining aspect ratio
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Line Distance',
                        color: 'black',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    suggestedMax: Math.max(...lineDistances), // Set the maximum value of the x-axis to the maximum line distance
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevation',
                        color: 'black',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });

    // Draw visual lines
    drawVisualLines(ctx);
}

function drawVisualLines(ctx) {
    // List of 10 distinct colors
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

    // Keep track of previous two colors
    let prevColor1, prevColor2;

    // Loop through each row and draw visual lines
    const rows = document.querySelectorAll('#pumpTableBody tr');
    rows.forEach((row, index) => {
        const from = parseFloat(row.querySelector(`input[name^="from-"]`).value) || 0;
        const to = parseFloat(row.querySelector(`input[name^="to-"]`).value) || 0;

        // Select color for the visual line
        let color;
        do {
            color = colors[Math.floor(Math.random() * colors.length)];
        } while (color === prevColor1 || color === prevColor2);

        // Update previous colors
        prevColor2 = prevColor1;
        prevColor1 = color;

        // Calculate coordinates for visual line
        const x1 = from;
        const y1 = elevationData[from];
        const x2 = to;
        const y2 = elevationData[to];

        // Draw visual line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.stroke();
    });
}