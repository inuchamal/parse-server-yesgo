const conf = require('config');
if (conf.newrelic)
    require('newrelic');
const express = require('express');
const PushAdapter = require('@parse/push-adapter').default;
const compression = require('compression');
const Server = require('parse-server').ParseServer;
const Utils = require('./lib/Utils.js');
const Dashboard = require('parse-dashboard');
const port = process.env.PORT || conf.port;
const server = conf.server;
const MASTERKEY = conf.masterKey;
const cached = require('./lib/Routes/CachedRoutes');
const ioClient = require('socket.io-client')(conf.realTime ? conf.realTime.realTimeUrl : 'localhost:2203');
//Temporary Script
const script = require('./databaseScript.js');
script.data.codeUppercase();
script.data.stateSearchName();
script.data.citySearchName();
console.log(conf);
let pushs = {android: conf.push.android, ios: []};
try {
    new PushAdapter(pushs);
} catch (e) {
    if (e.stack && e.stack.includes("Error: certificate has expired")){
        pushs.ios = [];
        Utils.sendEmailAlertBug("O certificado de push do IOS está expirado.")
    }
    console.log(e.stack || e);
}
if (conf.push.ios) {
    for (let i = 0; i < conf.push.ios.length; i++) {
        let p = conf.push.ios[i];
        p.pfx = __dirname + "/certs/" + p.pfx;
        pushs.ios.push(p)
    }
}
const redisOptions = {
    host: conf.redis.host,
    port: conf.redis.port,
    no_ready_check: true,
    auth: conf.redis.auth,
    auth_pass: conf.redis.auth
};
let s3Adapter = null, fileAdapter = null;
if (conf.s3Adapter) {
    let S3Adapter = require('@parse/s3-files-adapter');
    let MigratingAdapter = require('parse-server-migrating-adapter');
    let GridStoreAdapter = require('parse-server/lib/Adapters/Files/GridStoreAdapter').GridStoreAdapter;
    s3Adapter = new S3Adapter(conf.s3Adapter.accessKey,
        conf.s3Adapter.secretKey, conf.s3Adapter.bucket, {
            region: conf.s3Adapter.region,
            bucketPrefix: '',
            directAccess: false,
            baseUrl: '',
            signatureVersion: 'v4',
            globalCacheControl: 'public, max-age=86400'  // 24 hrs Cache-Control.
        });
    fileAdapter = new MigratingAdapter(s3Adapter, [new GridStoreAdapter(conf.databaseUri)])
}
/* varify invalid pushs */

const api = new Server({
    verbose: false,
    logLevel: "error",
    filesAdapter: fileAdapter,
    databaseURI: conf.databaseUri,
    cloud: __dirname + '/lib/main.js',
    appId: conf.appId,
    masterKey: MASTERKEY,
    serverURL: server,
    publicServerURL: server,
    appName: conf.appName,
    maxUploadSize: '1000Mb',
    allowClientClassCreation: true,
    preventLoginWithUnverifiedEmail: true,
    facebookAppIds: conf.FacebookID,
    push: pushs,
    liveQuery: {
        classNames: ["_User", "Travel"]
    },
    customPages: {
        invalidLink: undefined,
        verifyEmailSuccess: conf.linkPage + "/#/user/login",
        choosePassword: conf.linkPage + "/#/user/recover-password",
        passwordResetSuccess: conf.linkPage + "/#/user/login"
    },
});

const dashboard = new Dashboard({
    allowInsecureHTTP: true,
    "apps": [
        {
            "serverURL": server,
            "appId": conf.appId,
            "masterKey": MASTERKEY,
            "appName": conf.appName,
            "iconName": "icon.png"
        }],
    "users": [
        {
            "user": conf.appName.toLowerCase(),
            "pass": conf.appName.toLowerCase() + ".0)dash"
        }
    ],
    "trustProxy": 1
}, {allowInsecureHTTP: true});
const app = express();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const mountPath = '/use';
const bodyParser = require('body-parser');
app.use (bodyParser.json ({limit: '1mb', extended: true}));
app.use (bodyParser.urlencoded ({limit: '1mb', extended: true}));
app.use((req, res, next) => {
    if(req.body._SessionToken === "") {
        return res.status(400).send({
            code: 209,
            error: 'invalid session token'
        });
    }
    next()
});
const getExpeditiousCache = require('express-expeditious');
app.use(cached);
app.use(mountPath, api);
app.use('/dashboard', dashboard);
app.use(compression());
app.get('/', function (req, res) {
    res.status(200).send(':)');
});
app.get('/docs', function (req, res) {
    res.redirect(conf.docs);
});
app.use('/img', express.static('img'));

const exec = require('child_process').exec;


app.post('/webhook-id-wall', function (req, res) {
    if (conf.IdWall) {
        return require("./lib/Integrations/IDWall.js").instance().processWebhook(req.body).then(function () {
            res.json({message: 'success'});
        });
    } else {
        res.json({message: 'success'});
    }
});
app.post('/iugu', function (req, res) {
    require('./lib/Payment/Payment.js').instance().webhook({
        event: req.body.event,
        data: req.body.data
    }).then(function () {
        console.log("RESOLVE");
        res.sendStatus(200);
    }, function (error) {
        console.log("error", error)
    });
});
app.post('/payment', function (req, res) {
    console.log("\nxxxxPOSTABACK payment\n-->");
    console.log("-->", req.body);
    require('./lib/Payment/Payment.js').instance().webhook({
        event: req.body.event,
        data: req.body
    }).then(function () {
        res.sendStatus(200);
    }, function (error) {
        console.log("error", error)
    });
});

app.post('/git', function (req, res) {
    let branch = req.body.ref.split('/');
    if (branch.indexOf(conf.branch) >= 0) {
        const testscript = exec('git pull origin ' + conf.branch + '  && npm install && NODE_ENV=' + conf.env + ' forever restart index.js');
        testscript.stdout.on('data', function (data) {
            console.log(data);
        });
        testscript.stderr.on('data', function (data) {
            console.log(data);
        });
    }
    res.json({
        message: 'ok got it updated dev!'
    });
});
app.post('/gitCi', function (req, res) {

    if(req.body.token === conf.appId) {
        const fs = require('fs');
        const request = require('request');

        const headers = {
            'PRIVATE-TOKEN': conf.deployToken
        };

        const options = {
            url: 'https://gitlab.usemobile.com.br/api/v4/projects/'+req.body.CI_PROJECT_ID+'/jobs/'+req.body.CI_JOB_ID+'/artifacts',
            headers: headers,
            encoding: null
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                fs.writeFile('art.zip', body, 'binary',function(err) {
                    const testscript = exec('unzip -o art.zip ' + '  && npm install && NODE_ENV=' + conf.env + ' forever restart index.js');
                    testscript.stdout.on('data', function (data) {
                        console.log(data);
                    });
                    testscript.stderr.on('data', function (data) {
                        console.log(data);
                    });
                });
            }
        }
        request(options, callback);
    }
    res.json({
        message: 'ok got it updated!'
    });
});
const httpServer = require('http').createServer(app);

if (!process.env.NODE_ENV.includes('test')) {
    httpServer.listen(process.env.PORT || port, function () {
        console.log('Running on port ' + port + '.');
    });
}

script.data.includeCountries();
script.data.linkCountryState();
script.data.linkCountryStateBolivia();


if (!conf.disableJob) {
    require("./lib/RealTime/server")(httpServer, require('./lib/User.js').instance().updateUserLocation)
}
module.exports = httpServer;
