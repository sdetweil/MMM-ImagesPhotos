/*
* MagicMirror²
* Node Helper: MMM-ImagesPhotos
*
* By Rodrigo Ramìrez Norambuena https://rodrigoramirez.com
* MIT Licensed.
*/

const express = require("express");
const Log = require("logger");
const NodeHelper = require("node_helper");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const exifr = require("exifr");

module.exports = NodeHelper.create({
	// Override start method.
	config: {},
	path_images: {},
	start() {
		Log.log(`Starting node helper for: ${this.name}`);
	},

	setConfig(id) {
		if (this.config[id].debug) {
			Log.log(`setconfig path=${id}`);
		}
		this.path_images[id] = path.resolve(
		global.root_path,
		"modules/MMM-ImagesPhotos/uploads",
		this.config[id].path
		);
		if (this.config[id].debug) {
			Log.log(`path for : ${this.name} ${id}= ${this.path_images[id]}`);
		}
	},

	// Override socketNotificationReceived method.
	socketNotificationReceived(notification, payload) {
		if (notification === "CONFIG") {
			Log.log(`Config based debug=${payload.id}`);
			this.config[payload.id] = payload;
			this.setConfig(payload.id);
			this.extraRoutes(payload.id);
			this.sendSocketNotification("READY", payload.id);
		}
	},

	/*
	* Create routes for module manager.
	* Recive request and send response
	*/
	extraRoutes(id) {
		if (this.config[id].debug) {
			Log.log(`setting path=${id}`);
		}
		const self = this;

		this.expressApp.get(`/MMM-ImagesPhotos/photos/${id}`, (req, res) => {
			self.getPhotosImages(req, res, id);
		});

		this.expressApp.use(
		`/MMM-ImagesPhotos/photo/${id}`,
		express.static(self.path_images[id])
		);
	},

	// Return photos-images by response in JSON format.
	getPhotosImages(req, res, id) {
		if (this.config[id].debug) {
			Log.log(`gpi id=${id}`);
		}

		const directoryImages = this.path_images[id];
		const imgs = this.getFiles(directoryImages, id);
		const imgMap = this.getImages(imgs, id).map((img) => {
			
			if (this.config[id].debug) {
				Log.log(`${id} have image=${img}`);
			}
			
			return {id: id, img: img};
		});

		let imagesPhotos = [];
		var exifLat = "";
		var exifLon = "";
		var exifDate= "";
		
		try{
			(async () => {
				for (let k of Object.keys(imgMap)) {
					let curr = imgMap[k];
					
					let output = await exifr.parse(`${this.path_images[curr.id]}/${curr.img}`);
					
                    if (output == undefined){
                        exifLat = "";
                        exifLon = "";
                        exifDate= "";
                        if (this.config[id].debug) {
                            Log.info("No Exif Data Found");
                        }
                    }else{
                        
                        if (output.latitude == undefined){
                            exifLat = "";
                            if (this.config[id].debug) {
                                Log.info("No Latitude");
                            }
                            
                        }else{
                            exifLat = output.latitude ;
                            if (this.config[id].debug) {
                                Log.info(output.latitude);
                            }
                            
                        }
                        
                        if (output.longitude == undefined){
                            exifLon = "";
                            if (this.config[id].debug) {
                                Log.info("No Longitude");
                            }
                        }else{
                            exifLon = output.longitude ;
                            if (this.config[id].debug) {
                                Log.info(output.longitude);
                            }
                        }
                        
                        if (output.DateTimeOriginal == undefined){
                            exifDate= "";
                            if (this.config[id].debug) {
                                Log.info("No Exif Date");
                            }
                        }else{
                            
                            exifDate= output.DateTimeOriginal
                            if (this.config[id].debug) {
                                Log.info(output.DateTimeOriginal);
                            }
                        }
                    }
					
					
					
					
					imagesPhotos.push({url: `/MMM-ImagesPhotos/photo/${curr.id}/${curr.img}`,exif: `${exifDate}`,lat:`${exifLat}`, lon:`${exifLon}` });
				}
				res.send(imagesPhotos);
			})();
			
		} catch (error) {
			Log.error(`Error getting Exifdata: ${error}`);
		}
	},
	

	// Return array with only images
	getImages(files, id) {
		if (this.config[id].debug) {
			Log.log(`gp id=${id}`);
		}
		const images = [];
		const enabledTypes = ["image/jpeg", "image/png", "image/gif", "image/heic"];
		for (const idx in files) {
			if (idx in files) {
				const type = mime.lookup(files[idx]);
				if (enabledTypes.indexOf(type) >= 0 && type !== false) {
					images.push(files[idx]);
				}
			}
		}

		return images;
	},

	getFiles(filePath, id) {
		if (this.config[id].debug) {
			Log.log(`gf id=${id}`);
		}
		let files = [];
		const folders = [];
		try {
			// Log.log("finding files on path="+path)
			files = fs.readdirSync(filePath).filter((file) => {
				if (this.config[id].debug) {
					Log.log(`found file=${file} on path=${filePath}`);
				}
				if (fs.statSync(`${filePath}/${file}`).isDirectory()) {
					if (this.config[id].debug) {
						Log.log(`${id} saving folder path=${filePath}/${file}`);
					}
					folders.push(`${filePath}/${file}`);
				} else if (!file.startsWith(".")) {
					return file;
				}
			});

			folders.forEach((x) => {
				if (this.config[id].debug) {
					Log.log(`${id} processing for sub folder=${x}`);
				}
				const y = this.getFiles(x, id);
				// Log.log("list"+JSON.stringify(y))
				const worklist = [];
				// Get the number of elements in the base path
				const c = this.path_images[id].split("/").length;
				// Get the rest of the path
				const xpath = x.split("/").slice(c).join("/");
				y.forEach((f) => {
					// If the file doesn't have a path
					if (f.includes("/")) {
						// Use it as is

						worklist.push(f);
					} else {
						// Add it

						worklist.push(`${xpath}/${f}`);
					}
				});
				// Add to the files list
				files = files.concat(worklist);
				if (this.config[id].debug) {
					Log.log(`files after concat=${JSON.stringify(files)}`);
				}
			});
		} catch (exception) {
			Log.log(
			`getfiles unable to access source folder,path=${filePath} will retry, exception=${JSON.stringify(
			exception
			)}`
			);
		}
		if (this.config[id].debug) {
			Log.log(`${id} returning files=${JSON.stringify(files)}`);
		}

		return files;
	},

	sleep(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}
});
