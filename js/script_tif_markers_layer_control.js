document.addEventListener('DOMContentLoaded', () => {
    // Initialize the map
    const map = L.map('map').setView([36.52347, -118.26239], 13);

    // Define tile layers
    const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    });

    const topoTiles = L.tileLayer('./tiles/topo_tiles/{z}/{x}/{y}.png', {
        maxZoom: 19,
        maxNativeZoom: 15,
        noWrap: true,
        attribution: 'Scanned Topos'
    });

    const calTopoTiles = L.tileLayer('./tiles/ct_tiles/{z}/{x}/{y}.png', {
        maxZoom: 19,
        maxNativeZoom: 15,
        noWrap: true,
        attribution: 'Cal Topo'
    });

    // Add OpenStreetMap as the default layer
    openStreetMap.addTo(map);

    // Create a baseMaps object for layer control
    const baseMaps = {
        "OpenStreetMap": openStreetMap,
        "Scanned Topos": topoTiles,
        "Cal Topo": calTopoTiles
    };

    // Initialize overlayMaps object
    const overlayMaps = {};

    let locationLayer = null;
    let tracking = false;

    // Handle location tracking toggle
    document.getElementById('locate-btn').addEventListener('click', () => {
        if (tracking) {
            // Stop tracking
            if (locationLayer) {
                map.removeLayer(locationLayer);
                locationLayer = null;
            }
            tracking = false;
        } else {
            // Start tracking
            map.locate({ setView: true, maxZoom: 16 });
        }
    });

    // On location found, add a marker
    map.on('locationfound', (e) => {
        if (locationLayer) {
            map.removeLayer(locationLayer);
        }
        const radius = e.accuracy / 2;
        locationLayer = L.layerGroup([
            L.marker(e.latlng).bindPopup(`You are within ${Math.round(radius)} meters from this point`).openPopup(),
            L.circle(e.latlng, radius)
        ]).addTo(map);
        tracking = true;
    });

    // On location error
    map.on('locationerror', () => {
        alert('Location access denied or unavailable.');
    });

    // Add a layer control for base maps
    const baseMapsControl = L.control.layers(baseMaps, {}, { position: 'topleft', collapsed: false }).addTo(map);
    const baseMapsContainer = baseMapsControl.getContainer();
    const baseMapsLabel = document.createElement('h4');
    baseMapsLabel.innerText = 'Basemaps';
    baseMapsContainer.insertBefore(baseMapsLabel, baseMapsContainer.firstChild);

    // Add a layer control for overlays
    const overlaysControl = L.control.layers({}, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);
    const overlaysContainer = overlaysControl.getContainer();
    const overlaysLabel = document.createElement('h4');
    overlaysLabel.innerText = 'Layers';
    overlaysContainer.insertBefore(overlaysLabel, overlaysContainer.firstChild);

    // Add GeoTIFF overlay
    fetch('./imagery/lidar.tiff')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            parseGeoraster(arrayBuffer).then(georasterData => {
                const geotiffLayer = new GeoRasterLayer({
                    georaster: georasterData,
                    opacity: 0.5, // Set initial opacity
                    resolution: 256
                });

                geotiffLayer.addTo(map);
                map.fitBounds(geotiffLayer.getBounds());

                // Add GeoTIFF layer to overlayMaps
                overlayMaps["Lidar TIFF"] = geotiffLayer;

                // Update the layer control for overlays
                overlaysControl.addOverlay(geotiffLayer, "Lidar TIFF");

                // Add opacity control
                const opacityControl = L.control({ position: 'topright' });
                opacityControl.onAdd = function (map) {
                    const div = L.DomUtil.create('div', 'opacity-control');
                    div.innerHTML = '<label for="opacity-slider">TIFF Opacity</label><input id="opacity-slider" type="range" min="0" max="1" step="0.1" value="0.5">';
                    return div;
                };
                opacityControl.addTo(map);

                // Handle opacity change
                document.getElementById('opacity-slider').addEventListener('input', (event) => {
                    const opacity = event.target.value;
                    geotiffLayer.setOpacity(opacity);
                });
            }).catch(error => {
                console.error('Error parsing GeoRaster:', error);
            });
        })
        .catch(error => {
            console.error('Error loading GeoTIFF:', error);
        });

    // Load and add markers from GeoJSON
    fetch('./markers/markers.geojson')
        .then(response => response.json())
        .then(data => {
            const markersLayer = L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.description) {
                        layer.bindPopup(`<strong>${feature.properties.name}</strong><br>${feature.properties.description}`);
                    }
                }
            });

            // Add markers layer to the map
            markersLayer.addTo(map);

            // Add markers layer to overlayMaps
            overlayMaps["Markers"] = markersLayer;

            // Update the layer control for overlays
            overlaysControl.addOverlay(markersLayer, "Markers");
        })
        .catch(error => {
            console.error('Error loading GeoJSON:', error);
        });
});