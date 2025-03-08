import { ALBEvent, ALBResult, Context } from "aws-lambda";
import { PKPass } from "passkit-generator";
import {
	throwClientErrorWithoutModelName,
	createPassGenerator,
} from "../shared.js";

/**
 * Lambda for expirationDate example
 */

export async function expirationDate(event: ALBEvent, context: Context) {
	try {
		throwClientErrorWithoutModelName(event);
	} catch (err) {
		return err;
	}

	let { modelName, ...passOptions } = event.queryStringParameters;

	let passGenerator = createPassGenerator(modelName, passOptions);

	let pass = (await passGenerator.next()).value as PKPass;

	// 2 minutes later...
	let d = new Date();
	d.setMinutes(d.getMinutes() + 2);

	// setting the expiration
	(pass as PKPass).setExpirationDate(d);
	console.log(
		"EXPIRATION DATE EXPECTED:",
		(pass as PKPass).props["expirationDate"],
	);

	return (await passGenerator.next(pass as PKPass)).value as ALBResult;
}
