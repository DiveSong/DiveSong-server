const express=require("express");
const path = require('path');
const creds = require('./auth_details')
const mysql = require('mysql');
const db = require('./database');
const q = require('q');
const cookieParser = require('cookie-parser');
const package = require('./package');
const app=express();
const hash = require('./hash');
const crypto = require('crypto');
const fileSystem=require("fs");
const config = require('./config');
const mail = require('./mail');

app.use(cookieParser())

sql = {
host	: creds.sql.host,
user	: creds.sql.user,
password: creds.sql.password,
database: 'divesong'
}


app.get('/song',function(req,res) {
	//res.status(200).send(`Ok ${req.query.trackid} `)
	console.log(req.query)
	if( req.query.trackid === undefined || isNaN(Number(req.query.trackid)) ){
		res.status(400).send('Track ID required as an integer')
	}
	sql_query = `select tpath from track where tid = ${req.query.trackid}`
	get_path = () => new Promise((resolve,reject) => {
		resolve('getting path');
	})

	get_path()
		.then( result =>{
			console.log(result)
			return mysql.createConnection(sql);
		}, reason =>{
			console.log("Reject after resolve " + reason )
		})
		.then( connection=>{
			//console.log(connection)
			return new Promise(function(resolve, reject) {
				connection.query(sql_query,(err,result) =>{
					if(err){
						console.error(err);
					}
					//return result[0].tpath;
					if(result.length == 1){
						filePath = result[0].tpath
						console.log(`1: ${filePath}`)
						resolve(filePath)

					}
					else{
						console.log('test0');
						res.status(404).send('404 File Not Found');
						//throw new Error("404 File Not Found");
					}
				})
			});

		},reason =>{
			console.log("Reject after first then "+reason)
		})
		.then((filePath)=>{
			console.log(`2: ${filePath}`)
			if(typeof(filePath) === 'string'){
				let stat = fileSystem.statSync(filePath);
				return { "stat": stat,"filePath":filePath};
			}
			else{
				console.log("filePath must be a string. Instead got "+typeof(filePath));
			}
		},reason =>{
			console.log("Reject after second then "+reason)
		})
		.then( fileSend =>{

			var readStream = fileSystem.createReadStream(fileSend.filePath);
			res.writeHead(200, {
				'Content-Type': 'audio/mpeg',
				'Content-Length': fileSend.stat.size
		    })
			readStream.on('open', function () {
				readStream.pipe(res);
		    });
		},reason =>{
			console.log("Reject after third then "+reason)
			return reason
		})
		.then( result=>{
			console.log(`done`);
		},reason =>{
			console.log("Reject after forth then "+reason)
		}).catch(error=>{
			console.error(error);
		})


});





app.post('/like',async function(req,res) {

	async function getAuthenticate(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from authenticate where uid = ${uid} `,(err,result) => {
				resolve(result)
			})
		});
	}

	async function like(uid,tid,operation){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into uhistory values (${uid},${operation=='like'?1:-1},${tid},'${new Date().toISOString().replace('T',' ').replace('Z','')}')`,(err,result) => {
				if(err){
					console.error(err);
					resolve(err);
				}
				resolve(result)
			})
		});
	}
	async function removeLiked(uid,tid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`delete from uhistory where uid=${uid} and tid=${tid} and (to_oper=1 or to_oper=-1)`,(err,result) => {
				if(err){
					console.error(err);
					resolve(err);
				}
				resolve(true)
			})
		});
	}

	async function checkLiked(uid,tid,operation){
		return new Promise(function(resolve, reject) {
			new_oper = operation==='like'?1:-1
			connection = mysql.createConnection(sql);
			connection.query(`select * from uhistory where uid=${uid} and tid=${tid} and (to_oper=1 or to_oper=-1)`,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve([result.length,result.length>1?result[0].to_oper===new_oper:0])	//if second part is 1 then then don't delete and add otherwise delete and add

			})

		});
	}

	console.log(req.cookies);
	tid=req.query.tid;
	operation = req.query.operation;
	uid = Number(req.cookies.uid);
	user_agent = req.headers['user-agent']
	auth_token = req.cookies.auth_token

	authenticateEntry = await getAuthenticate(uid,auth_token).then(result=>{return result;},reason=>{console.error(reason);});

	if(tid === undefined || operation === undefined ){
		res.status(400).send(`<b>400</b> Bad Request<hr><center>${package.name} v.${package.version}`)
		return false;
	}else if (uid === undefined || isNaN(uid) || user_agent === undefined || auth_token === undefined || authenticateEntry[0] === undefined) {
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
	}

	console.log(authenticateEntry);


	let authentic = (user_agent,auth_token,authenticateEntry) =>{
		allowed_time = new Date(authenticateEntry[0].tme.getTime() + 30*24*60*60*1000)
		if(user_agent === authenticateEntry[0].user_agent && auth_token === authenticateEntry[0].auth_token && allowed_time > new Date()){
			return true;
		} else {
			return false;
		}

	}
	console.log(authentic(user_agent,auth_token,authenticateEntry));

	if(operation=='like' || operation=='dislike'){
		if(authentic(user_agent,auth_token,authenticateEntry)){
			likeExists = await checkLiked(uid,tid,operation);
			if(likeExists!==undefined && likeExists[0] !== 0 && likeExists[1] === 0)
			{
				status = await removeLiked(uid,tid)
				if(status === true )
				{
					status = await like(uid,tid,operation)
				}
			}else if(likeExists!==undefined &&likeExists[0] !== 0 && likeExists[1] === 1){
				status = await removeLiked(uid,tid)
			} else if(likeExists!==undefined && likeExists[0]!==1){
				result = await like(uid,tid,operation)
				console.log(result)
			}
			res.writeHead(200, {
				'Content-Type': 'text/html',
			})
			res.end(`<b>200</b> Ok<hr><center>${package.name} v.${package.version}`);
		}
		else{
			res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
		 }
	 }
	 else{
		 res.status(400).send(`<b>400</b> Bad Request<hr><center>${package.name} v.${package.version}`)
	 }

});


app.get('/songlist',async function(req,res){
	function listSongs(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from track`,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
		});
	}
	let output = await listSongs()
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})

app.get('/history',async function(req,res){
	function listSongsHistory(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from thistory`,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
		});
	}
	let output = await listSongsHistory()
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})

app.get('/nextSongs',async function(req,res){
	function listNextSongs(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from next_tracks`,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
		});
	}
	let output = await listNextSongs()
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})

app.get('/userhistory',async (req,res)=>{
	uid = req.query.uid;
	if(uid === undefined)
	{
		res.status(400).send(`<b>400</b> Bad Request<hr><center>${package.name} v.${package.version}`)
	}
	function userHistory(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from uhistory where uid = ${uid}`,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
		});
	}
	let output = await userHistory(uid)
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})

app.post('/updateUser',async function(req,res) {

	async function getAuthenticate(uid,auth_token){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from authenticate where uid = ${uid} and auth_token = ${auth_token}`,(err,result) => {
				resolve(result)
			})
		});
	}

	console.log(req.query);
	uid = Number(req.cookies.uid);
	user_agent = req.headers['user-agent']
	auth_token = req.cookies.auth_token


	authenticateEntry = await getAuthenticate(uid,auth_token).then(result=>{return result;},reason=>{console.error(reason);});

	if (uid === undefined || isNaN(uid) || user_agent === undefined || auth_token === undefined || authenticateEntry[0] === undefined) {
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
	}

	console.log(authenticateEntry);


	let authentic = (user_agent,auth_token,authenticateEntry) =>{
		allowed_time = new Date(authenticateEntry[0].tme.getTime() + 30*24*60*60*1000)
		if(user_agent === authenticateEntry[0].user_agent && auth_token === authenticateEntry[0].auth_token && allowed_time > new Date()){
			return true;
		} else {
			return false;
		}

	}
	console.log(authentic(user_agent,auth_token,authenticateEntry));

	if(authentic(user_agent,auth_token,authenticateEntry)){
		res.writeHead(200, {
			'Content-Type': 'application/json',
			'Content-Length': (JSON.stringify(data)).length
		})
		res.end(JSON.stringify(data));
	}
	else{
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
	}


    var user= {
        "password":req.query.password,
        "uid":req.query.uid,
        "uname":req.query.uname,
        "email":req.query.email,
        "fname":req.query.fname,
        "lname":req.query.lname,
        "everify":req.query.everify

    }

    if(!authentication(password,fname,lname)){
        res.status(401).send('401 authentication problem');
    }
     else{
     res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': (JSON.stringify(user)).length
        })
     console.log(data);
     res.end(JSON.stringify(user));

    }

})


app.post('/login',async function(req,res) {

	async function getHash(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from pass where uid = ${uid}`,(err,result) => {
				resolve(result)
			})
		});
	}
	async function setToken(uid,auth_token,user_agent,allowed_time){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into authenticate values (${uid},'${auth_token}','test_mac','${user_agent}','${allowed_time}')`,(err,result)=>{
				resolve(result);
			})
		});
	}
	user_agent = req.headers['user-agent']
	uid = req.query.uid;
    hmac=JSON.parse(req.query.hmac);
	if ( req.query.secret !== creds.client.secret )
	{
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
	}
    userHash = await getHash(uid);
	if(userHash.length != 1 ){
		res.status(403).end('User not registered')
		return false;
	}
	outputHash = hash.digestHmac(hmac,userHash[0].salt);
	if (outputHash != userHash[0].passhash){
		res.status(401).end('Wrong Credentials')
	}
	auth_token = crypto.randomBytes(256).toString('hex');
	allowed_time = new Date(new Date() + 30*24*60*60*1000).toISOString();
	allowed_time.replace('T',' ').replace('Z','');
	tokenOutput = setToken(uid,auth_token,user_agent,allowed_time)
    res.writeHead(200, {
         'Content-Type': 'text/html',
         'Content-Length': ('Successfull').length
         })
    res.end('Successfull');
})


app.post('/mail',async function(req,res){
	async function getDetails(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from users where uid = ${uid}`,(err,result) => {
				resolve(result)
			})
		});
	}
	uid = req.query.uid;
	userDetails = await getDetails(uid);
	if ( userDetails.length != 1){
		res.status(404).end("User not found");
		return false;
	}
	mailOptions = {
		to: userDetails[0].email,
		subject: req.query.subject,
		html: req.query.Content
	};
	data = await mail.sendMail(mailOptions);
	res.end(JSON.stringify(data));
	console.log(JSON.stringify(data));




})


app.post('/addUser',function(req,res) {
    var user= {

        "uid":req.query.uid,
        "uname":req.query.uname,
        "email":req.query.email,
        "fname":req.query.fname,
        "lname":req.query.lname,
        "everify":req.query.everify

    }

    data={};
    data=user;
    console.log(data);

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': (JSON.stringify(data)).length
        })

     res.end(JSON.stringify(data));

})



var server = app.listen(config.host.port,config.host.hostname,function(){
    console.log(`app listening at http://${config.host.hostname}:${config.host.port}`)
})
