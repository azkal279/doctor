/**
 * PKPass.from static method example.
 * Here it is showed manual model reading and
 * creating through another PKPass because in the other
 * examples, creation through templates is already shown
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { PKPass } from "passkit-generator";
import { app } from "./webserver.js";
import { getCertificates } from "./shared.js";

let __dirname = path.dirname(fileURLToPath(import.meta.url));

// ******************************************** //
// *** CODE FROM GET MODEL FOLDER INTERNALS *** //
// ******************************************** //

/**
 * Removes hidden files from a list (those starting with dot)
 *
 * @params from - list of file names
 * @return
 */

export function removeHidden(from: Array<string>): Array<string> {
	return from.filter((e) => e.charAt(0) !== ".");
}

async function readFileOrDirectory(filePath: string) {
	if ((await fs.lstat(filePath)).isDirectory()) {
		return Promise.all(await readDirectory(filePath));
	} else {
		return fs
			.readFile(filePath)
			.then((content) => getObjectFromModelFile(filePath, content, 1));
	}
}

/**
 * Returns an object containing the parsed fileName
 * from a path along with its content.
 *
 * @param filePath
 * @param content
 * @param depthFromEnd - used to preserve localization lproj content
 * @returns
 */

function getObjectFromModelFile(
	filePath: string,
	content: Buffer,
	depthFromEnd: number,
) {
	let fileComponents = filePath.split(path.sep);
	let fileName = fileComponents
		.slice(fileComponents.length - depthFromEnd)
		.join("/");

	return { [fileName]: content };
}

/**
 * Reads a directory and returns all the files in it
 * as an Array<Promise>
 *
 * @param filePath
 * @returns
 */

async function readDirectory(filePath: string) {
	let dirContent = await fs.readdir(filePath).then(removeHidden);

	return dirContent.map(async (fileName) => {
		let content = await fs.readFile(path.resolve(filePath, fileName));
		return getObjectFromModelFile(
			path.resolve(filePath, fileName),
			content,
			2,
		);
	});
}

// *************************** //
// *** EXAMPLE FROM NOW ON *** //
// *************************** //

let passTemplate = new Promise<PKPass>(async (resolve) => {
	let modelPath = path.resolve(__dirname, `../../models/examplePass.pass`);
	let [modelFilesList, certificates] = await Promise.all([
		fs.readdir(modelPath),
		getCertificates(),
	]);

	let modelRecords = (
		await Promise.all(
			/**
			 * Obtaining flattened array of buffer records
			 * containing file name and the buffer itself.
			 *
			 * This goes also to read every nested l10n
			 * subfolder.
			 */

			modelFilesList.map((fileOrDirectoryPath) => {
				let fullPath = path.resolve(modelPath, fileOrDirectoryPath);

				return readFileOrDirectory(fullPath);
			}),
		)
	)
		.flat(1)
		.reduce((acc, current) => ({ ...acc, ...current }), {});

	/** Creating a PKPass Template */

	return resolve(
		new PKPass(modelRecords, {
			wwdr: certificates.wwdr,
			signerCert: certificates.signerCert,
			signerKey: certificates.signerKey,
			signerKeyPassphrase: certificates.signerKeyPassphrase,
		}),
	);
});

app.route("/pkpassfrom/:modelName").get(async (request, response) => {
	let passName =
		request.params.modelName +
		"_" +
		new Date().toISOString().split("T")[0].replace(/-/gi, "");

	let templatePass = await passTemplate;

	try {
		let pass = await PKPass.from(
			templatePass,
			request.body || request.params || request.query,
		);

		if (pass.type === "boardingPass" && !pass.transitType) {
			// Just to not make crash the creation if we use a boardingPass
			pass.transitType = "PKTransitTypeAir";
		}

		let stream = pass.getAsStream();

		response.set({
			"Content-type": pass.mimeType,
			"Content-disposition": `attachment; filename=${passName}.pkpass`,
		});

		stream.pipe(response);
	} catch (err) {
		console.log(err);

		response.set({
			"Content-type": "text/html",
		});

		response.send(err.message);
	}
});
