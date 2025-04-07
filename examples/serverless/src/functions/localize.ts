import {
	throwClientErrorWithoutModelName,
	createPassGenerator,
} from "../shared.js";
import type { ALBEvent, ALBResult } from "aws-lambda";
import type { PKPass } from "passkit-generator";

/**
 * Lambda for localize example
 */

export async function localize(event: ALBEvent) {
	try {
		throwClientErrorWithoutModelName(event);
	} catch (err) {
		return err;
	}

	let { modelName, ...passOptions } = event.queryStringParameters;

	let passGenerator = createPassGenerator(modelName, passOptions);

	let pass = (await passGenerator.next()).value as PKPass;

	/**
	 * Italian and German already has an .lproj which gets included
	 * but it doesn't have translations
	 */
	pass.localize("it", {
		EVENT: "Evento",
		LOCATION: "Dove",
	});

	pass.localize("de", {
		EVENT: "Ereignis",
		LOCATION: "Ort",
	});

	// ...while Norwegian doesn't, so it gets created
	pass.localize("nn", {
		EVENT: "Begivenhet",
		LOCATION: "plassering",
	});

	console.log("Added languages", Object.keys(pass.languages).join(", "));

	return (await passGenerator.next(pass as PKPass)).value as ALBResult;
}
