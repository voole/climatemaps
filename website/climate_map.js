
// http://stackoverflow.com/a/4234006
$.ajaxSetup({beforeSend: function(xhr) {
    if (xhr.overrideMimeType)
    {
      xhr.overrideMimeType("application/json");
    }
}
});

var dataDir = "data/";
var lineScaleFactor = 0.3;

var map = new ol.Map({
    target: 'map',
    interactions: ol.interaction.defaults({keyboard:false}),  // disable because this moves the map when using the arrow keys to change the slider
});

var view = new ol.View( {center: [0, 0], zoom: 3, projection: 'EPSG:3857'} );
map.setView(view);

var osmSource = new ol.source.OSM("OpenCycleMap");
osmSource.setUrl("http://a.tile.opencyclemap.org/transport/{z}/{x}/{y}.png");
//osmSource.setUrl("http://a.tile.openstreetmap.org/{z}/{x}/{y}.png");
//osmSource.setUrl("https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png");
//osmSource.setUrl("http://a.tile.stamen.com/toner/{z}/{x}/{y}.png");

var osmLayer = new ol.layer.Tile({source: osmSource});

map.addLayer(osmLayer);

var lon = 0.0;
var lat = 10.0;
view.setCenter(ol.proj.fromLonLat([lon, lat]));

var plotTypesMonthsLayers = {};
var plotTypesMonthsImages = {};


//
//var imageLayer = createImageLayer('precipitation', 1);
//
//map.addLayer(imageLayer);

function createImageLayer(dataType, monthNr) {
    return new ol.layer.Image({
        source: new ol.source.ImageStatic({
            url: dataDir + 'contour_' + dataType + '_' + monthNr + '.png',
            projection: map.getView().getProjection(),
            imageExtent: ol.extent.applyTransform([-180, -85, 180, 85], ol.proj.getTransform("EPSG:4326", "EPSG:3857"))
        }),
        opacity: getImageOpacity()
    });
}


function addContours(dataType, monthNr)
{
    $.getJSON(dataDir + "contour_" + dataType + "_" + monthNr + ".json", function(json) {
        var contourLayers = createContoursLayer(json.contours);
        if ( !(dataType in plotTypesMonthsLayers)) {
            plotTypesMonthsLayers[dataType] = {};
            plotTypesMonthsImages[dataType] = {};
        }
        var imageLayer = createImageLayer(dataType, monthNr);
        map.addLayer(imageLayer);
        plotTypesMonthsImages[dataType][monthNr] = imageLayer;
        plotTypesMonthsLayers[dataType][monthNr] = contourLayers;
    });
}


function getLineWidth() {
    return 0.5 + Math.pow(view.getZoom(), 1.5)  * lineScaleFactor;
}


function getImageOpacity() {
    var zoomedOut = 0.7;
    var zoomLevelToStart = 5;
    var zoom = view.getZoom();
    if (zoom < zoomLevelToStart) {
        return zoomedOut
    }
    return zoomedOut - (view.getZoom()-zoomLevelToStart) / 5.0;
}


function createContoursLayer(contours) {
    console.log('create new contour layers');
    console.log(contours.length + ' contours');
    var contourLayers = [];

    // each contour can have multiple (including zero) paths.
    for (var k = 0; k < contours.length; ++k)
    {
        var paths = contours[k].paths;
        for (var j = 0; j < paths.length; ++j)
        {
            var markers = [];
            for (var i = 0; i < paths[j].x.length; ++i)
            {
                var lon = paths[j].x[i];
                var lat = paths[j].y[i];
                var lonLat = [lon, lat];
                markers.push(ol.proj.fromLonLat(lonLat));
            }

            var color = [paths[j].linecolor[0]*255, paths[j].linecolor[1]*255, paths[j].linecolor[2]*255, 1.0];

            var lineStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: getLineWidth()
                })
            });

            var layerLines = new ol.layer.Vector({
                source: new ol.source.Vector({
                    features: [new ol.Feature({
                        geometry: new ol.geom.LineString(markers, 'XY'),
                        name: paths[j].label
                    })],
                    wrapX: false
                }),
                style: lineStyle
            });

            layerLines.setZIndex(99);
            contourLayers.push(layerLines);
            map.addLayer(layerLines);
        }
    }

    return contourLayers;
}


map.addControl(new ol.control.FullScreen());
// map.addControl(new ol.control.ZoomSlider());

// Tooltip

var info = $('#info');

var displayFeatureInfo = function(pixel) {
  info.css({
    left: (pixel[0] + 10) + 'px',
    top: (pixel[1] - 50) + 'px',
  });

  var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
    return feature;
  });

  if (feature) {
    info.text(feature.get('name'));
    info.show();
  } else {
    info.hide();
  }
};


map.on('pointermove', function(evt) {
  if (evt.dragging) {
    info.hide();
    return;
  }
  displayFeatureInfo(map.getEventPixel(evt.originalEvent));
});


// Select features

//var select = new ol.interaction.Select({
//    condition: ol.events.condition.click
//});
//
//select.on('select', function(evt) {
//    for (var i = 0; i < contourLayers.length; ++i)
//    {
//        var removedLayer = map.removeLayer(contourLayers[i]);
//    }
//    contourLayers.length = 0;
//    addContours(1);
//});

//map.addInteraction(select);

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];


$(function() {
    $("#month-slider").slider({
      orientation: "horizontal",
      range: "min",
      min: 0,
      max: 12,
      value: 0,
      slide: sliderChanged,
      change: sliderChanged
    })
    .slider("pips", {
        rest: "label",
        labels: months
    });
//    .slider("float");
});


var hideAllContours = function() {
    console.log('hide all contours');
    var type;
    var month;
    for (type in plotTypesMonthsLayers) {
        for (month in plotTypesMonthsLayers[type]) {
            for (var i = 0; i < plotTypesMonthsLayers[type][month].length; ++i) {
                plotTypesMonthsLayers[type][month][i].setVisible(false);
            }
        }
    }

    for (type in plotTypesMonthsImages) {
        for (month in plotTypesMonthsImages[type]) {
            plotTypesMonthsImages[type][month].setVisible(false);
        }
    }
};


var showOrCreateContour = function(monthNr) {
    console.log("showOrCreateContour");
    hideAllContours();
    var selectedType = getSelectedType();
    if ( !plotExists(selectedType, monthNr) ) {
        addContours(selectedType, monthNr);
    }
    else {
        var monthLayers = plotTypesMonthsLayers[selectedType][monthNr];
        var monthImage = plotTypesMonthsImages[selectedType][monthNr];
        monthImage.setVisible(true);
        for (var i = 0; i < monthLayers.length; ++i) {
            monthLayers[i].setVisible(true);
        }
    }
};

var setSliderValue = function(monthNr) {
    console.log('set slider value')
    var slider = $("#month-slider");
    if (monthNr >= 13) {
        slider.slider("value", 0);
    } else if (getSliderValue() != monthNr-1) {
        slider.slider("value", monthNr-1);
    };
};


var getSliderValue = function() {
    var slider = $("#month-slider");
    return slider.slider("value");
};


var sliderChanged = function() {
    var slider = $("#month-slider");
    var monthNr = getSliderValue() + 1;
    if (monthNr == 13) {
        slider.slider("value", 0);
    }
    console.log("slider changed to: " + monthNr);

    searchParams.set('month', monthNr);
    window.history.replaceState({}, '', `${location.pathname}?${searchParams}`);

    showOrCreateContour(monthNr);
};


var intervalID = 0;

var toggleAnimation = function() {
    var playButton = document.getElementById('animate-button');
    var selectedType = getSelectedType();
    if (playButton.innerHTML == "Animate") {
        for (var i = 1; i < 13; ++i) {
            if ( !plotExists(selectedType, i) ) {
                addContours(selectedType, i);
            }
        }
        playButton.innerHTML = "Stop";
        intervalID = window.setInterval(playAnimation, 800);
    }
    else {
        window.clearInterval(intervalID);
        playButton.innerHTML = "Animate";
    }
};


var playAnimation = function() {
    var slider = $("#month-slider");
    var monthNr = slider.slider("value");
    slider.slider("value", monthNr+1);
};


document.getElementById("animate-button").onclick = toggleAnimation;


var selectDataType = function selectDataType(valueToSelect)
{
    var element = document.getElementById('select-type');
    element.value = valueToSelect;
}

var getSelectedType = function() {
    return document.getElementById("select-type").value;
};


var typeChanged = function() {
    var selection = getSelectedType();
    searchParams.set('datatype', selection);
    window.history.replaceState({}, '', `${location.pathname}?${searchParams}`);
    console.log(selection);
    sliderChanged();
};


document.getElementById("select-type").onchange = typeChanged;

var plotExists = function(typeName, monthNr) {
    return typeName in plotTypesMonthsLayers && plotTypesMonthsLayers[typeName].hasOwnProperty(monthNr);
};


map.on("moveend", function() {
    var type;
    var month;
    for (type in plotTypesMonthsLayers) {
        for (month in plotTypesMonthsLayers[type]) {
            for (var i = 0; i < plotTypesMonthsLayers[type][month].length; ++i) {
                var oldStyle = plotTypesMonthsLayers[type][month][i].getStyle();
                oldStyle.getStroke().setWidth(getLineWidth());
                plotTypesMonthsLayers[type][month][i].setStyle(oldStyle);
            }
        }
    }
    for (type in plotTypesMonthsImages) {
        for (month in plotTypesMonthsImages[type]) {
            plotTypesMonthsImages[type][month].setOpacity( getImageOpacity() );
        }
    }
});


var currentUrl = window.location.href;
var url = new URL(window.location.href);
var searchParams = new URLSearchParams(url.search.slice(1));
console.log(searchParams);
console.log(searchParams.get('datatype'));  // outputs "m2-m3-m4-m5"

var initialDataType = 'precipitation';
if (searchParams.has('datatype')) {
    initialDataType = searchParams.get('datatype');
};

var initialMonth = 1;
if (searchParams.has('month')) {
    initialMonth = searchParams.get('month');
};

selectDataType(initialDataType);
addContours(initialDataType, initialMonth);  // initial contour of January

var onLoad = function() {
    setSliderValue(initialMonth);
};

window.onload = onLoad;