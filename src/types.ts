import {LatLngExpression} from "leaflet"

export type LineConfig = {
	positions: LatLngExpression[];
	depth: number;
	category: LineCategory;
}

export type LineCategory = {
    id: number;
    color: string;
    identity: any;
}