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
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import {map, Map, tileLayer, polyline, LatLngExpression, latLng, Polyline} from "leaflet"
import { VisualFormattingSettingsModel } from "./settings";

function verifyNumber(data: powerbi.DataViewTableRow) : asserts data is number[] {
    for (const datum of data){
        if (typeof datum !== "number") throw "error";
    }
}

class LineData {
    latLongs: LatLngExpression[];
    color: string;
    id: number;

    constructor(latLongs: LatLngExpression[], id: number, color?: string) {
        this.id = id;
        this.latLongs = latLongs;
        
        if (this.color) {
            this.color = color;
        } else {

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

	constructor(options: VisualConstructorOptions) {

		this.formattingSettingsService = new FormattingSettingsService();
		this.target = options.element;

		if (document) {

			const map_element = document.createElement("div");
			map_element.id = "map";
			this.target.appendChild(map_element);
			
			this.map = map(map_element).setView([0, 0], 13);
			
			tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
			
		}
	}

	public update(options: VisualUpdateOptions) {
        //hent nye verdier
		this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        const columns = options.dataViews[0].table.columns;

		//resett tidligere verdier
		for (const cord of this.cords) {
			cord.remove();
		}

		this.cords = [];

		this.cordDict = {};


        // hent dataindekser
        let indexes: Record<string, number> = {};

        let hasId: boolean = false;

        for (let keyIndex = 0; keyIndex < columns.length; keyIndex ++) {

            for (const key of Object.keys(columns[keyIndex].roles)) {

                if (key == "cable_id") hasId = true;

                indexes[key] = keyIndex;
            }
        }

        
		
		for (const row of options.dataViews[0].table.rows) {

            verifyNumber(row);

            let cableIndex: number = 0;

            if (hasId) cableIndex = row[indexes["cable_id"]];
			

			//ser om ledningen er i ordboken, hvis ikke lager den en ny ledning
			if (this.cordDict[cableIndex]){
				this.cordDict[cableIndex].push(latLng(row[indexes["cable_x"]], row[indexes["cable_y"]]));

			} else {
				this.cordDict[cableIndex] = [latLng(row[indexes["cable_x"]], row[indexes["cable_y"]])];
			}
			
		}

		for (const [key, line] of Object.entries(this.cordDict)){
			let newCord: Polyline = polyline(line, {color: "red"}).addTo(this.map);
			this.cords.push(newCord);
			
		}
        
		this.map.fitBounds(this.cords[0].getBounds());
        
	}

	public getFormattingModel(): powerbi.visuals.FormattingModel {
		return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
	}
}