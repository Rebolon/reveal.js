var express		= require('express');
var fs			= require('fs');
var io			= require('socket.io');
var crypto		= require('crypto');

var app			= express.createServer();
var staticDir	= express.static;

io				= io.listen(app);

var opts = {
	port: 1948,
	baseDir : __dirname + '/../../',
    sessionsDir: __dirname + '/../../session/'
};

/**
 * Creation de routes dynamiques:
 *  * repertoire de base ./session + date + nom de la presentation
 *  * il faut au moins 2 fichiers : 
 *      * .revealjs : pour indiquer que c'est bien une prés revealjs
 *      * index.html : pour le client ou le mode standard
 *      * master.html : si on veut le multiplex actif en mode client/master
 * 
 *  * dans le html il faut bien :
 *      * mettre / devant les lib communes à revealjs (lib/plugin/js/css)
 *      * avoir un répertoire img dans sa présentation (session/date/mapres/img) pour y stocker ses images et ne pas commencer par / dans l'attribut src, mais par "img/monimage.img"
 * 
 */
var createRoutes = function funcCreateRoutes() {
    var listOfSessionDates = fs.readdirSync(opts.sessionsDir),
        listOfSessionPres;

    listOfSessionDates.forEach(function funcSessionRoutes(sessionDir) {
        try {
            listOfSessionPres = fs.readdirSync(opts.sessionsDir + sessionDir);
            listOfSessionPres.forEach(function funcSessionPresRoutes(presDir) {
                var route = "/" + sessionDir + "/" + presDir,
                    filePath = opts.sessionsDir + sessionDir + "/" + presDir;

                if (fs.existsSync(filePath + "/.revealjs")) {
                    if (fs.existsSync(filePath + "/index.html")) {
                        app.get(route, function(req, res) {
                            fs.createReadStream(filePath + "/index.html").pipe(res);
                        });
                    }
                    
                    if (fs.existsSync(filePath + "/master.html")) {
                        app.get(route + "/master", function(req, res) {
                            fs.createReadStream(opts.sessionsDir + sessionDir + "/" + presDir + "/master.html").pipe(res);
                        });
                    }
                    
                    [ 'css', 'js', 'plugin', 'lib', 'img' ].forEach(function(dir) {
                        if (fs.existsSync(filePath + "/" + dir)) {
                            app.use(route + "/img/", staticDir(opts.sessionsDir + sessionDir + "/" + presDir + "/" + dir + "/"));
                        }
                    });
                }
            });
        } catch (e) {
            console.log('Exception: ', e);
        }
    });
};

io.sockets.on('connection', function(socket) {
	socket.on('slidechanged', function(slideData) {
		if (typeof slideData.secret == 'undefined' || slideData.secret == null || slideData.secret === '') return;
		if (createHash(slideData.secret) === slideData.socketId) {
			slideData.secret = null;
			socket.broadcast.emit(slideData.socketId, slideData);
		};
	});
});

app.configure(function() {
	[ 'css', 'js', 'plugin', 'lib' ].forEach(function(dir) {
		app.use('/' + dir, staticDir(opts.baseDir + dir));
	});
});

createRoutes();

app.get("/token", function(req,res) {
	var ts = new Date().getTime();
	var rand = Math.floor(Math.random()*9999999);
	var secret = ts.toString() + rand.toString();
	res.send({secret: secret, socketId: createHash(secret)});
});

var createHash = function(secret) {
	var cipher = crypto.createCipher('blowfish', secret);
	return(cipher.final('hex'));
};

// Actually listen
app.listen(opts.port || null);

var brown = '\033[33m',
	green = '\033[32m',
	reset = '\033[0m';

console.log( brown + "reveal.js:" + reset + " Multiplex running on port " + green + opts.port + reset );