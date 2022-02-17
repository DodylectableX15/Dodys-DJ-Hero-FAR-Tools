// File System, Path,  dirname and readFileSync execution Stuff

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

var dat;
var off = 0;
var farHeader = {};

function TermString()
{
	var temp = "";
	
	while (dat[off] !== 0x00)
	{
		temp += String.fromCharCode(dat[off]);
		off ++;
	}
	
	// Skip past terminator
	off ++;
	
	return temp;
}

// -- READ A FAR ENTRY ------------
function ReadFAREntry()
{
	// Location after the header, they're all 288 bytes
	var postPos = off + 288;
	
	// Location of file information
	var infoPos = off + 0x100;

	console.log("reading FAR entry at " + off);
	
	var entry = {};
	
	entry.name = TermString();
	
	off = infoPos;
	
	entry.unk = dat.readUInt32BE(off);
	off += 4;
	
	entry.uncom_length = dat.readUInt32BE(off);
	off += 4;
	
	entry.unkB = dat.readUInt32BE(off);
	off += 4;
	
	entry.com_length = dat.readUInt32BE(off);
	off += 4;
	
	entry.unkC = dat.readUInt32BE(off);
	off += 4;
	
	var relativeOffset = dat.readUInt32BE(off);
	off += 4;
	
	// REAL offset!
	entry.offset = farHeader.fileOffsets + relativeOffset;
	
	console.log(relativeOffset);
	
	// Uncompress the data!
	if (entry.com_length < entry.uncom_length)
	{
		var compressed = dat.slice(entry.offset, entry.offset + entry.com_length);
		entry.data = zlib.inflateSync(compressed);
	}
	else
		entry.data = dat.slice(entry.offset, entry.offset + entry.com_length);
	
	farHeader.files.push(entry);
	
	off = postPos;
}

// -- GET PROPER OUT DESTINATION --------
function GetProperOutPath(outPath, fileName)
{
	// Replace all \ with our path separator
	var rep = fileName.replace(/\\/g, path.sep);
	
	return path.join(outPath, rep);
}

// -- EXTRACT FAR ARCHIVE ---------------
function ExtractFAR(inFile, outDir)
{
	dat = fs.readFileSync(inFile);
	
	// Header Stuff

	farHeader = {};

	farHeader.Magic = dat.slice(0, 4).toString();          // Magic
	farHeader.unk = dat.readUInt32BE(4);                  // unk
	farHeader.fileOffsets = dat.readUInt32BE(8);         // File Offsets
	farHeader.fileCount = dat.readUInt32BE(12);         // File Count

	// Files

	farHeader.files = [];
	off = 32;

	// Reading FAR Entries

	for (var l=0; l<farHeader.fileCount; l++)
		ReadFAREntry();

	// Logging Data

	console.log(farHeader)
	
	// -- EXTRACT THE FILES --
	
	for (var e=0; e<farHeader.files.length; e++)
	{
		var entry = farHeader.files[e];
		var finalOutPath = GetProperOutPath(outDir, entry.name);
		console.log("Unpacked: " + finalOutPath);
		
		// Ensure folder exists
		var dir = path.dirname(finalOutPath);
		if (!fs.existsSync(dir))
			fs.mkdirSync(dir, {recursive: true});
		
		fs.writeFileSync(finalOutPath, entry.data);
	}
}

// Get absolute path one way or another
function GetRealDirectory(inPath)
{
	if (path.isAbsolute(inPath))
		return inPath;
	else
		return path.join(__dirname, inPath);
}

var args = process.argv;
args.shift();
args.shift();

if (args.length > 1)
{
	var inPath = GetRealDirectory(args[0]);
	var outPath = GetRealDirectory(args[1]);
	
	// In path exists
	if (fs.existsSync(inPath))
	{
		// Make sure user doesn't pull any funny business and specify a file as out path
		if (outPath.indexOf(".") >= 0)
			outPath = path.dirname(outPath);
		
		// Ensure out folder exists
		if (!fs.existsSync(outPath))
			fs.mkdirSync(outPath, {recursive: true});
			
		ExtractFAR(inPath, outPath);
	}
	else
		console.log("In .FAR doesn't exist");
}
else
	console.log("Please specify input file and output directory!");
