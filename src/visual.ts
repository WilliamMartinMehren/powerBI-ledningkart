/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { LineCategory, LineConfig } from "./types";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette


import {map, Map, tileLayer, polyline, LatLngExpression, latLng, Polyline, Bounds, Point, LatLngBounds, LatLng} from "leaflet"
import { VisualFormattingSettingsModel } from "./settings";

function verifyNumber(data: powerbi.DataViewTableRow) : asserts data is number[] {
	for (const datum of data){
		if (typeof datum !== "number") throw "error";
	}
}


class LineSegment {
	positions: LatLngExpression[];
	depth: number;
	category: LineCategory;
	constructor(config: LineConfig) {
		this.positions = config.positions;
		this.depth = config.depth;
		this.category = config.category;
	}
	render(depthScale: number): Polyline {
		return polyline(this.positions, {color: this.category.color});
	}
}

class LineData {
	lines: LineSegment[] = [];
    lineConfigs: Record<number, LineConfig[]>;
	lineBounds: LatLngBounds = new LatLngBounds(latLng(0,0), latLng(0,0));
    
    host: IVisualHost;

    colorHelper: ColorHelper;

	colors: string[] = [];
	categories: LineCategory[] = [];

	table: powerbi.DataViewTable;

	indexes: Record<string, number> = {};

    colorPalette: ColorPalette;

    constructor(host: IVisualHost) {
        this.host = host;
        this.colorPalette = host.colorPalette;
        this.colorHelper = new ColorHelper(this.colorPalette);
    }

    minPoints(points: LatLng[]): LatLng {
        let minPoint: LatLng;
        for (const [index, point] of points.entries()) {
            if (index === 0) {
                minPoint = point;
            }
            if (point.lat < minPoint.lat) minPoint.lat = point.lat;
            if (point.lng < minPoint.lng) minPoint.lng = point.lng;
        }
        return minPoint;
    }

    maxPoints(points: LatLng[]): LatLng {
        let maxPoint: LatLng;
        for (const [index, point] of points.entries()) {
            
            if (point.lat > maxPoint.lat) maxPoint.lat = point.lat;
            if (point.lng > maxPoint.lng) maxPoint.lng = point.lng;
        }
        return maxPoint;
    }
    

	parseTable(options: VisualUpdateOptions) {
		this.table = options.dataViews[0].table;
        this.categories = [];
		this.lineConfigs = {};
        this.lines = [];
		
		
	    // hent indekser fra tabellen
		for (let keyIndex = 0; keyIndex < this.table.columns.length; keyIndex ++) {
            
			for (const key of Object.keys(this.table.columns[keyIndex].roles)) {

				this.indexes[key] = keyIndex;
			}
		}
		//del opp dataen i linjer
        let objects = options.dataViews[0].metadata.objects;
		for (const row of this.table.rows) {
			verifyNumber(row);
			const lineId: number = row[this.indexes["cable_id"]];
			
			const lineX: number = row[this.indexes["cable_x"]];
			const lineY: number = row[this.indexes["cable_y"]];
			const lineZ: number = row[this.indexes["cable_z"]];

            let categoryIsUnique: boolean = true;
            let lineCategory: LineCategory;
            for (const [index, category] of this.categories.entries()) {

                if (category.id === row[this.indexes["category"]]) {
                    categoryIsUnique = false;
                    lineCategory = category;
                    break;
                }
            }

            if (categoryIsUnique) {
                lineCategory = {
                    id: row[this.indexes["category"]], 
                    color: this.colorHelper.getColorForSeriesValue(objects, row[this.indexes["category"]]),
                    identity: this.host.createSelectionIdBuilder().createSelectionId()};
                this.categories.push(lineCategory);
            }


            
			
			
			const config: LineConfig = {
				positions: [[lineX, lineY]],
				depth: lineZ,
				category: lineCategory
			};


			 if (lineId in this.lineConfigs) {
				this.lineConfigs[lineId].push(config);
			} else {
				this.lineConfigs[lineId] = [config];
			}

		}

		for (const [key, configs] of Object.entries(this.lineConfigs)) {

			let previousConfig: LineConfig

			for (const config of configs) {


				
				this.lines.push(new LineSegment(config));

				if (previousConfig){
					previousConfig.positions.push(config.positions[0])
				}

				previousConfig = config
			}
		}
	
	}
	
}

export class Visual implements IVisual {
	private target: HTMLElement;
	private formattingSettings: VisualFormattingSettingsModel;
	private formattingSettingsService: FormattingSettingsService;

	private map: Map;
	private cordDict: Record<number, LatLngExpression[]> = {};
	private cords: Polyline[] = [];
	private lineData: LineData;

	constructor(options: VisualConstructorOptions) {
		this.formattingSettingsService = new FormattingSettingsService();
		this.target = options.element;


		this.lineData = new LineData(options.host);

		if (document) {

			const map_element = document.createElement("div");
			map_element.id = "map";
			this.target.appendChild(map_element);
			
			this.map = map(map_element).setView([59.75041174941852, 10.153830077740539], 13);
			
			tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
			
		}
	}
    

	public update(options: VisualUpdateOptions) {
		//hent nye verdier
		this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        console.log(this.formattingSettings.dataPointCard.slices)
        this.formattingSettings.populateDataPointSlices(this.lineData.categories);
        
        
        
        
        let renderedLines: Polyline[] = [];

        for (const line of renderedLines) {
            line.remove();
        }

        
		this.lineData.parseTable(options);
        
        for (const [index, category] of this.lineData.categories.entries()) {

            category.color = this.formattingSettings.dataPointCard.slices[index]["value"]["value"];
        }



        for (const [key, line] of Object.entries(this.lineData.lines)) {
            console.log(line.category)
            let lineRender: Polyline = line.render(.5);
            renderedLines.push(lineRender);
            lineRender.addTo(this.map);
        }
	}

	public getFormattingModel(): powerbi.visuals.FormattingModel {
		return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
	}
}