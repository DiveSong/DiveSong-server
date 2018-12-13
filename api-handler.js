
const express=require("express");
const path = require('path');
const creds = require('./auth_details')
const mysql = require('mysql');
//const db = require('./database');
//const q = require('q');
const cookieParser = require('cookie-parser');
const package = require('./package');
const app=express();
const hash = require('./hash');
const crypto = require('crypto');
const fileSystem=require("fs");
const config = require('./config');
const mail = require('./mail');


app.use(function(req, res, next) {
	//Allow CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


sql = {
host	: creds.sql.host,
user	: creds.sql.user,
password: creds.sql.password,
database: 'divesong'
}

function runQuery(query,error_string,success_string){
	return new Promise(function(resolve, reject) {
		let connection = mysql.createConnection(sql);
		connection.query(query,(err,result) => {
			if(err){
				console.error(err);
				console.log(error_string);
				connection.end()
				resolve(0)
			}
			else{
				console.log(success_string);
				resolve(result)
			}
		})
		connection.end()
	})
}


app.get('/song',function(req,res) {	//Send songs to download
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
				return { "filePath":filePath};
			}
			else{
				console.log("filePath must be a string. Instead got "+typeof(filePath));
			}
		},reason =>{
			console.log("Reject after second then "+reason)
		})
		.then( fileSend =>{
			res.sendFile(fileSend.filePath);
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

	async function getAuthenticate(uid,auth_token){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from authenticate where uid = ${uid} and auth_token="${auth_token}" `,(err,result) => {

				resolve(result)
			})
			connection.end()
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
			connection.end()
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
			connection.end()
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

				resolve([result.length,result.length>=1?result[0].to_oper===new_oper:0])	//if second part is 1 then then don't delete and add otherwise delete and add

			})
			connection.end()

		});
	}

	tid=req.query.tid;
	operation = req.query.operation;
	uid = Number(req.query.uid);
	user_agent = req.query['user-agent']
	auth_token = req.query.auth_token

	console.log(req.query)

	if(tid === undefined || operation === undefined || isNaN(tid) || isNaN(uid)){
		res.status(400).send(`<b>400</b> Bad Request<hr><center>${package.name} v.${package.version}`)
		return 1;
	}

	authenticateEntry = await getAuthenticate(uid,auth_token)

	if (uid === undefined || isNaN(uid) || user_agent === undefined || auth_token === undefined || authenticateEntry === undefined || authenticateEntry.length === 0 || authenticateEntry[0] === undefined) {
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
		return 2;
	}



	status = await removeLiked(uid,tid)
	// console.log(authenticateEntry);


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
			// console.log(likeExists);
			if(likeExists!==undefined && likeExists[0] != 0 && likeExists[1] == 0)
			{
				if(status === true )
				{
					// console.log(1);
					status = await like(uid,tid,operation)
				}
			}else if(likeExists!==undefined &&likeExists[0] != 0 && likeExists[1] == 1){
				status = await removeLiked(uid,tid)
			} else if(likeExists!==undefined && likeExists[0]!=1){
				result = await like(uid,tid,operation)
				// console.log(result)
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

});	//API to like a track

app.post('/request',async function(req,res){

	function getAuthenticate(uid,auth_token){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from authenticate where uid = ${uid} and auth_token="${auth_token}" `,(err,result) => {
				if(err){
					console.error(err);

					resolve(undefined);
				}

				resolve(result)
			})
			connection.end()
		});
	}

	async function isRequested(tid){
		return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from req_list where tid = ${tid} `,(err,result) => {
				if(err){
					console.error(err);

					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});

	}
	async function isRequestedByUser(uid,tid){
		return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from uhistory where tid = ${tid} and uid=${uid} and to_oper=0 `,(err,result) => {
				if(err){
					console.error(err);

					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});

	}

	async function updateUhistory(uid,tid){
		return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into uhistory values (${uid},${0},${tid},"${new Date().toISOString().replace('T',' ').replace('Z','')}")`,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}
	async function request(uid,tid){
		return new Promise(async function(resolve, reject) {
			requested = await isRequested(tid);
			update_user = await updateUhistory(uid,tid);
			connection = mysql.createConnection(sql);
			if(requested === undefined || requested.length === 0 ){
				query = `insert into req_list values ("${new Date().toISOString().replace('T',' ').replace('Z','')}",${tid},${1})`;
			}
			else {
				query = `update req_list set num_req = ${requested[0].num_req+1} where tid = ${tid}`
			}
			connection.query(query,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}

	async function unrequest(uid,tid){
		return new Promise(async function(resolve, reject) {
			requested = await isRequested(tid);
			if(requested === undefined || requested.length <= 1 ){
				runQuery(`delete from next_tracks where tid = ${tid}`);
				runQuery(`delete from req_list where tid = ${tid}`)
				runQuery(`delete from uhistory where tid= ${tid} and uid = ${uid}`)
			}
			else {

				runQuery(`update req_list set num_req = ${requested[0].num_req-1} where tid = ${tid}`)
				runQuery(`delete from uhistory where tid= ${tid} and uid = ${uid}`);
			}
		});
	}

	tid=req.query.tid;
	uid = Number(req.query.uid);
	user_agent = req.query['user-agent']
	auth_token = req.query.auth_token

	authenticateEntry = await getAuthenticate(uid,auth_token)

	if (uid === undefined || isNaN(uid) || user_agent === undefined || auth_token === undefined || authenticateEntry === undefined || authenticateEntry.length === 0 || authenticateEntry[0] === undefined) {
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
		return 2;
	}

	let authentic = (user_agent,auth_token,authenticateEntry) =>{
		allowed_time = new Date(authenticateEntry[0].tme.getTime() + 30*24*60*60*1000)
		if(user_agent === authenticateEntry[0].user_agent && auth_token === authenticateEntry[0].auth_token && allowed_time > new Date()){
			return true;
		} else {
			return false;
		}

	}


	requestedByUser = await isRequestedByUser(uid,tid);
	if( requestedByUser!= undefined && requestedByUser.length>0)
	{
		unrequest_result = await unrequest(uid,tid);
		if(unrequest_result === undefined){
			res.status(500).send("Server Error")
		}
		else {
			res.status(200).send("Ok")
		}
		return 0;
	}
	request_result = await request(uid,tid);
	if(request_result === undefined){
		res.status(500).send("Server Error")
	}
	else {
		res.status(200).send("Ok")
	}

})	//API to request a track

app.get('/songlist',async function(req,res){
	function listSongs(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query = `select track.tid as id , track.name, track.artists, aname as album ,uh.to_oper  as 'like' from track left join (select * from uhistory where uid = 0 and  to_oper<>0) as uh on track.tid=uh.tid;`
			if( uid !== undefined){
				// console.log('uid is there')
				query = `select track.tid as id , track.name, track.artists, aname as album ,uh.to_oper  as 'like' from track left join (select * from uhistory where uid = ${uid} and  to_oper<>0) as uh on track.tid=uh.tid;`
			}
			connection.query(query,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});
	}
	uid = req.query.uid;
	let output = await listSongs(uid)
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(JSON.stringify(output));
	res.end(JSON.stringify(output));

})	//API to get all the songs present. having uid will also tell 'like'

app.get('/search',async function(req,res){	//API to search via a word if the word isn't defined, will work like songlist + mostPlayed
	async function getPlayed(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select track.tid as id, name,cn.number as number from track inner join (select tid,count(tid) as number from thistory group by tid order by count(tid) desc) as cn on track.tid=cn.tid limit 10`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});;
	}
	async function getRequested(uid){
		return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select ti.id from uhistory inner join (select tid as id from track) as ti on ti.id=uhistory.tid where  uid=${uid} and to_oper=0 `,(err,result) => {
				if(err){
					console.error(err);

					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});

	}

	function listSongsBySearch(uid,searchQuery){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			if (searchQuery === undefined){
				searchQuery=''
			}
			query = `select track.tid as id , track.name, track.artists, aname as album ,uh.to_oper  as 'like' from track left join (select * from uhistory where uid = 0 and  to_oper<>0) as uh on track.tid=uh.tid where track.name like '%${searchQuery}%' or track.aname like '%${searchQuery}%' or track.artists like '%${searchQuery}%';`
			if( uid !== undefined){
				// console.log('uid is there')
				query = `select track.tid as id , track.name, track.artists, aname as album ,uh.to_oper  as 'like' from track left join (select * from uhistory where uid = ${uid} and  to_oper<>0) as uh on track.tid=uh.tid where track.name like '%${searchQuery}%' or track.aname like '%${searchQuery}%' or track.artists like '%${searchQuery}%';`
			}
			connection.query(query,(err,result) => {
				if(err)
				{
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});
	}
	uid = req.query.uid;
	searchQuery =req.query.search;

	list = await getPlayed();
	if(list == undefined){
		res.status(500).send("Internal Error")
		return 1;
	}
	console.log(list);
	list = list.slice(0,10);


	let output = await listSongsBySearch(uid,searchQuery)
	for( j in output ){
		output[j].maxPlayed=0;
	}
	for (i in list){
		t_tid=list[i].id;
		for ( j in output ){
			if (t_tid == output[j].id){
				output[j].maxPlayed=1
			}
		}
	}

	list2 = await getRequested(uid);
	if(list2 == undefined){
		res.status(500).send("Internal Error")
		return 1;
	}
	console.log(list2);

	for( j in output ){
		output[j].requested=0;
	}
	for (i in list2){
		t_tid=list2[i].id;
		for ( j in output ){
			if (t_tid == output[j].id){
				output[j].requested=1
			}
		}
	}


	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(JSON.stringify(output));
	res.end(JSON.stringify(output));

})

app.get('/trackHistory',async function(req,res){
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
			connection.end()
		});
	}
	let output = await listSongsHistory()
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})	// API to return contents from thistory table. For future upgrade

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
			connection.end()
		});
	}
	let output = await listNextSongs()
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})	//API to get list of nextSongs - from table next_tracks


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
			connection.end()
		});
	}
	let output = await userHistory(uid)
	res.writeHead(200, {
		'Content-Type': 'text/html',
	})
	console.log(output);
	res.end(JSON.stringify(output));

})	// get user's history from uhistory

/*
// We aren't letting user update information in Version 1.0
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
	uid = Number(req.query.uid);
	user_agent = req.query['user-agent']
	auth_token = req.query.auth_token


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
*/

app.post('/login',async function(req,res) {
	async function getDetails(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from users where uid = "${uid}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	async function getHash(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from pass where uid = ${uid}`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	async function setToken(uid,auth_token,user_agent,allowed_time){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into authenticate values (${uid},'${auth_token}','test_mac','${user_agent}','${allowed_time}')`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});
	}
	async function getUid(uname){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from users where uname = "${uname}" or email = "${uname}"`,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				else if(result === undefined ||  result[0] === undefined || result[0].uid === undefined){
					resolve(undefined);
				}
				else {
					resolve(result[0].uid);
					console.log(result[0].uid);
				}
			})
			connection.end()
		});
	}
	async function tokenExists(auth_token){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from authenticate where auth_token = "${auth_token}"`,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				if(result === undefined ||  result[0] === undefined || result.length === 0){
					resolve(0);
				}
				else {
					resolve(1);
				}
			})
			connection.end()
		});
	}

	user_agent = req.query["user-agent"]
	uname = req.query.uname;
	if(uname === undefined){
		res.status(401).send("Bad Credentials")
		return 1;
	}
	uid = await getUid(uname);
	if (uid === undefined ){
		res.status(401).send("Bad Credentials")
		return 1;
	}
    password=req.query.password
	if ( req.query.secret !== creds.client.secret )
	{
		res.status(401).send(`<b>401</b> Unauthorized<hr><center>${package.name} v.${package.version}`)
		return 0;
	}
    userHash = await getHash(uid);
	if(userHash.length != 1 ){
		res.status(403).end('User not registered')
		return false;
	}
	outputHash = hash.sha512(password,userHash[0].salt);
	outputHash = outputHash['passwordHash'];
	if (outputHash != userHash[0].passhash){
		res.status(401).end('Wrong Credentials<br>'+outputHash+"<br>"+userHash[0].salt)
		return 0;
	}
	do{
		auth_token = crypto.randomBytes(128).toString('hex');
	}while(await tokenExists(auth_token))

	allowed_time = new Date(new Date() + 30*24*60*60*1000).toISOString();
	allowed_time = allowed_time.replace('T',' ').replace('Z','');
	tokenOutput = await setToken(uid,auth_token,user_agent,allowed_time)
	user = await getDetails(uid);
	if (user == undefined || user.length <1 || user[0]== undefined){
		res.status(403).end('User not registered')
		return 0;
	}
	user = user[0]
	content = {
		uname: user.uname,
		email: user.email,
		fname: user.fname,
		lname: user.lname,
		uid: uid,
		auth_token: auth_token
	}
	console.log(content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));

})	//API to check if given Credentials satisfied and client is real

app.get('/image',async function (req,res){
	async function getImagePath(tid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select imgpath from track where tid=${tid}`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
					return 0;
				}
				else if(result.length<1){
					resolve(undefined);
					return 0;
				}
				resolve(result[0].imgpath);

			})
			connection.end()
		});;
	}
	tid = req.query.tid;
	let imPath;
	if(tid==undefined){
		img = fileSystem.readFileSync(config.image.default);
	}
	else{
		imPath = await getImagePath(tid)
	}
	if(imPath == undefined ){
		img = fileSystem.readFileSync(config.image.default);
	}
	else{
		console.log(imPath);
		img = fileSystem.readFileSync(imPath);
	}

	res.writeHead(200, {'Content-Type': 'image/gif' });
	res.end(img, 'binary');

	res.send()
})

app.get('/detailNextSong',async function (req,res){
	async function getNext(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select tid, mind.ind from next_tracks inner join ( select min(ind) as ind from next_tracks) as mind on mind.ind = next_tracks.ind  ;`,(err,result) => {
				if(err || result.length <1){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}
	async function getDetails(){
		return new Promise(async function(resolve, reject) {
			next = await getNext()
			if(next.length == 0){
				console.log("Request list empty");
				return undefined;
			}
			connection = mysql.createConnection(sql);
			connection.query(`select name,artists,aname as album from track where tid=${next[0].tid}`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});
	}
	details = await getDetails();
	details = details[0];
	console.log(details);
	res.status(200).send(JSON.stringify(details));
})	// Get the details of the nextSong to be played

app.get('/playNextSong',async function(req,res) {
	async function getNext(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select tid, mind.ind from next_tracks inner join ( select min(ind) as ind from next_tracks) as mind on mind.ind = next_tracks.ind  ;`,(err,result) => {
				if(err || result.length <1){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}
	async function getPath(){
		return new Promise(async function(resolve, reject) {
			next = await getNext()
			if(next.length == 0){
				console.log("Request list empty");
				return undefined;
			}
			connection = mysql.createConnection(sql);
			connection.query(`select tpath from track where tid=${next[0].tid}`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});
	}
	filePath = await getPath();
	if(filePath ==undefined || filePath.length<1){
		res.status(500).send("Internal error");
		return 0;
	}
	filePath=filePath[0].tpath;
	console.log(filePath);
	var stat = fileSystem.statSync(filePath);
	if(filePath === undefined){
		res.status(500).send("Internal Error");
		return 0;
	}
	res.writeHead(200, {
		'Content-Type': 'audio/mpeg',
		'Content-Length': stat.size
	})


	var readStream = fileSystem.createReadStream(filePath);
	// We replaced all the event handlers with a simple call to readStream.pipe()
	readStream.on('open', function () {
	// This just pipes the read stream to the response object (which goes to the client)
	readStream.pipe(res);
	});


})	// Get stream of the nextSong

app.get('/mostPlayed',async function(req,res){
	async function getPlayed(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select track.tid as id, name,cn.number as number from track inner join (select tid,count(tid) as number from thistory group by tid order by count(tid) desc) as cn on track.tid=cn.tid;`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result);
			})
			connection.end()
		});;
	}
	list = await getPlayed();
	list = list.slice(0,10);
	if(list == undefined){
		res.status(500).send("Internal Error")
		return 1;
	}
	listString = JSON.stringify(list);
	res.status(200).send(listString);
	console.log(listString)
})

app.post('/mail',async function(req,res){
	async function getDetails(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from users where uid = ${uid}`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	uid = req.query.uid;
	userDetails = await getDetails(uid);
	if ( userDetails.length != 1){
		res.status(404).end("User not found");
		return false;
	}
	mailOptions = {
		from: "DiveSong Server",
		to: userDetails[0].email,
		subject: req.query.subject,
		html: req.query.Content
	};
	data = mail.sendMail(mailOptions);
	res.end(JSON.stringify(data));
	console.log(JSON.stringify(data));




})	// Mail a user


app.post('/addUser',async function(req,res) {
	async function setUserDetails(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into users (uname,email,fname,lname,everify) values ("${user.uname}","${user.email}","${user.fname}","${user.lname}",1)`,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}
	async function getDetails(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from users where uname = "${user.uname}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	async function setUserPassword(user){
		return new Promise(async function(resolve, reject) {
			userDetails = await getDetails(user)
			console.log(userDetails);
			uid = userDetails[0].uid;
			hashSalt = hash.saltHashPassword(user.password);
			connection = mysql.createConnection(sql);
			connection.query(`insert into pass values (${uid},"${hashSalt.passwordHash}","${hashSalt.salt}")`,(err,result) => {
				if(err){
					console.error(err);
					resolve(undefined);
				}
				resolve(result)
			})
			connection.end()
		});
	}
    var user= {
        "uname":req.query.uname,
        "email":req.query.email,
        "fname":req.query.fname,
        "lname":req.query.lname,
		"password": req.query.password
    }
	if(user===undefined || user.uname === undefined || user.email === undefined || user.fname === undefined || user.lname === undefined || user.password === undefined)
	{
		res.status(400).send("Bad Request");
	}
	insertDetails = await setUserDetails(user);
	if (insertDetails === undefined){
		res.status(409).send("Username or E-Mail already exists")
		return 1;
	}
	insertPassword = await setUserPassword(user);
	if(insertPassword === undefined){
		res.status(500).send("Error occured");
		return 2;
	}
    res.status(200).send(JSON.stringify({Successful:"Successful"}));

})	// Sign Up API



var server = app.listen(config.host.port,config.host.hostname,function(){
    console.log(`app listening at http://${config.host.hostname}:${config.host.port}`)

})
