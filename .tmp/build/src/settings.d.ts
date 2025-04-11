import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { LineCategory } from "./types";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
/**
 * Data Point Formatting Card
 */
declare class DataPointCardSettings extends FormattingSettingsCard {
    fill: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
/**
* visual settings model class
*
*/
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    dataPointCard: DataPointCardSettings;
    cards: DataPointCardSettings[];
    populateDataPointSlices(categories: LineCategory[]): void;
}
export {};
