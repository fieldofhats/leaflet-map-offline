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

    // Add GeoTIFF overlay
    fetch('./imagery/lidar.tiff')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            parseGeoraster(arrayBuffer).then(georasterData => {
                const geotiffLayer = new GeoRasterLayer({
                    georaster: georasterData,
                    opacity: 0.7,
                    resolution: 256
                });

                geotiffLayer.addTo(map);
                map.fitBounds(geotiffLayer.getBounds());

                // Create an overlayMaps object for layer control
                const overlayMaps = {
                    "Lidar TIFF": geotiffLayer
                };

                // Add a layer control to the map
                L.control.layers(baseMaps, overlayMaps, { position: 'topleft' }).addTo(map);
            }).catch(error => {
                console.error('Error parsing GeoRaster:', error);
            });
        })
        .catch(error => {
            console.error('Error loading GeoTIFF:', error);
        });
});