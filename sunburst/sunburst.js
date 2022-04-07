import * as dscc from "@google/dscc";
import Helper from "../js/d3-common";
import * as msg from "../js/messages";
import Sunburst from "./src/sunburst-obj";
import "./src/d3-sunburst.scss";
import * as _ from "lodash";

const d3 = Object.assign({}, require("d3-fetch"), require("d3-selection"));

// General Settings
const LOCAL = "localhost"; // your local dev hostname
const minSize = 300;

/* 
** Execute only if data studio returns data 
** (https://github.com/googledatastudio/ds-component/issues/33)

** D3 Object requires certain settings
** - DOM ID and dataset when creating the object
** - dimensionsAccessor: Array of dimensions to be rendered (each dimension = 1 ring)
*/

function drawViz(rawData) {
    console.log("Here's your rawData:");
    console.log(JSON.stringify(rawData))
    
    // First Error check: component size
    console.log("Preparing DOM:");
    prepareDOM();

    console.log("Checking Size:");
    const dim = Helper.getMaxDimensions("body");
    if (dim.max < minSize) {
        renderErrorMessage(msg.resizeTitle, msg.sizeError);
        return;
    }

    console.log("converting data:");
    const data = convertData(rawData);
    if (data) {
        console.log("We have Data!");
        const root = prepareDOM();

        console.log("Preparing Tooltip:");
        createTooltip(root);

        console.log("Creating sunburst object:");
        const sunburst = new Sunburst("body", data.tables);

        // Dimensions and Metric of viz
        console.log("Getting Dimentions");
        sunburst.metricAccessor = rawData.fields.metric[0].name;
        sunburst.dimensionsAccessor = [];
        rawData.fields.dimension.forEach((d, i) => {
            sunburst.dimensionsAccessor[i] = d.name;
        });

        console.log("Getting Styles");
        // Instance ID for multiple usage in same report
        sunburst.instanceID = Helper.getStyleValue(data.style, "instanceID");

        // Color Scheme
        sunburst.colorScheme = Helper.getStyleValue(data.style, "arcColors");
        sunburst.colorSchemeReversed = Helper.getStyleValue(
            data.style,
            "colorSchemeReversed"
        );

        // Font Color
        sunburst.fontColor = Helper.getStyleValue(
            data.style,
            "fontColor"
        ).color;
        sunburst.fontOpacity = Helper.getStyleValue(
            data.style,
            "fontColor"
        ).opacity;

        // Draw Legend
        sunburst.legend = Helper.getStyleValue(data.style, "isLegend");

        //Draw Labels
        console.log("Getting islabeled");
        
        sunburst.isLabeled = Helper.getStyleValue(data.style, "isLabeled");

        // #### Filtering ####
        console.log("Filtering");
        // Dimensions ID
        sunburst.dimensionsAccessorId = [];
        rawData.fields.dimension.forEach((d, i) => {
            sunburst.dimensionsAccessorId[i] = d.id;
        });

        // interactionId
        const interactionId = "sunburstFilter";
        sunburst.interactionId = interactionId;

        // No filtering for local setup
        sunburst.LOCAL = LOCAL;

        // Clear brush if filter was removed from DS
        const isFilterData = data.interactions[interactionId].value.data;
        if (isFilterData === "undefined" || typeof isFilterData === "undefined") {
            sunburst.isFilterData = false;

        } else {
            sunburst.isFilterData = true;

        }

        const filterEnabled = data.interactions[interactionId].value.type;
        if (filterEnabled === "undefined" || typeof filterEnabled === "undefined") {
            sunburst.filterEnabled = false;
            sunburst.AnimDuration = 750;
        } else {
            sunburst.filterEnabled = true;
            sunburst.AnimDuration = 0;
        }
        console.log("Drawing!");
        // Draw the visualization
        sunburst.draw();
    } else {
        renderErrorMessage(msg.loadingTitle, msg.dataError);
    }
}

/*
 ** D3 expects an ID in the tag the viz should be rendered
 ** D3 expects a certain DOM structure for the tooltip
 ** Data Studio suggests to delete the svg each time the viz is created
 */

function createTooltip(root) {
    const tooltip = root
        .append("div")
        .attr("id", "tooltip")
        .attr("class", "tooltip");

    tooltip.append("span").attr("id", "title");
    tooltip.append("span").attr("id", "count");
}

function prepareDOM() {
    const root = d3.select("body").attr("id", "body");

    // Clean everything
    d3.select("body")
        .selectAll("svg")
        .remove();

    d3.select("#error").remove();
    d3.select("#tooltip").remove();

    return root;
}

/*
 ** Data expected by the d3 object equals data returned by d3.csv:
 ** Combine Metrics and Dimensions in single object per record
 ** Return object with different sets (data + fields, style, theme, interactions)
 */
function convertData(dsObj) {
    const tableData = dsObj.tables.DEFAULT;
    console.log(`Dataset contains ${tableData.length} records`);

    if (tableData.length == 0) {
        return;
    }

    // CONVERT DS data format into D3 style
    const fields = dsObj.fields.dimension.concat(dsObj.fields.metric);

    const data = [];
    tableData.map(d => {
        const row = d.dimension.concat(d.metric);
        const obj = {};
        fields.forEach((f, i) => {
            obj[f.name] = row[i];
        });
        data.push(obj);
    });

    const returnObj = {};
    returnObj.tables = data;
    returnObj.fields = fields;
    returnObj.style = dsObj.style;
    returnObj.theme = dsObj.theme;
    returnObj.interactions = dsObj.interactions;
    return returnObj;
}

/* try catch only for DS */
function draw(data) {
    if (window.location.hostname == LOCAL) {
        window.addEventListener("resize", executeDebounced);
        drawViz(data);
    } else {
        try {
            drawViz(data);
        } catch (err) {
            renderErrorMessage(msg.errorTitle, `${msg.generalError} ${err}`);
        }
    }
}

/* Load data (LOCAL) or take from Google DS */
async function sunburst() {
    if (window.location.hostname == LOCAL) {
        console.log("This is ment to be local right?");
        const theDataSet = await d3.json("./data/DS-data-documentation.json");
        draw(theDataSet);
    } else {
        // define and use a callback
        var unsubscribe = dscc.subscribeToData(function (data) {
            // console.log the returned data
            console.log("Hi there here is the data:");
            console.log(data);
        }, { transform: dscc.tableTransform });

        // to unsubscribe

        unsubscribe();

        dscc.subscribeToData(draw, { transform: dscc.objectTransform });
    }
}

// debounce instead of calling sunburst() directly
const executeDebounced = _.debounce(sunburst, 600, {
    'leading': true,
    'trailing': true
});
executeDebounced();

// ** ERROR HANDLING **
function renderErrorMessage(errTitle, errMsg) {
    const root = prepareDOM();
    Helper.renderErrorMessage(root, errTitle, errMsg);
}
