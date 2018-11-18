'use strict'
var mi = require('mediainfo-wrapper')
var mysql = require('mysql');
var execSync = require('child_process').execSync;
let creds = require('./auth_details')

let promise = new Promise((req,res)=>{
console.log('promise started')
})


var dta={}
var val={}
var pth=[]
let paths=""
let frmts=""
var tname='NULL'
var artists='NULL'
var genre='NULL'
var alname='\'Unknown\''
var dur='NULL'
var bit='NULL'
var rdate='NULL'

function value(dta)
{

		if(dta['general']['recorded_date']!=undefined)
			rdate='\''+parseInt(dta['general']['recorded_date']).toString()+'-01-01\''

		if(dta['general']['duration']!=undefined)
			dur=parseInt(dta['general']['duration'][0]/1000)

		if(dta['general']['overall_bit_rate']!=undefined)
			bit=parseInt(dta['general']['overall_bit_rate'][0]/1000)


		if(dta['general']['title']!=undefined)
			tname='\''+dta['general']['title']+'\''
		else
			tname='\''+dta['general']['file_name']+'\''


		if(dta['general']['performer']!=undefined && dta['general']['composer']!=undefined)
			artists='\''+dta['general']['performer']+' '+dta['general']['composer']+'\''
		else if(dta['general']['performer']==undefined && dta['general']['composer']!=undefined)
			artists='\''+dta['general']['composer']+'\''
		else if(dta['general']['performer']!=undefined && dta['general']['composer']==undefined)
			artists='\''+dta['general']['performer']+'\''


		if(dta['general']['genre']!=undefined)
			genre='\''+dta['general']['genre']+'\''

		if(dta['general']['album']!=undefined)
			alname='\''+dta['general']['album']+'\''
}


var con = mysql.createConnection({
  host: creds.sql.host,
  user: creds.sql.user,
  password: creds.sql.password,
  database: "divesong"
});


let parsed = require('./parser.js')
console.log('test1')
parsed.formats.forEach((x)=>{frmts=frmts+"\\."+x+"$|"})
frmts=frmts.substring(0,frmts.length-1)

console.log('test2')
let dir = '';
for(var i=0;i<parsed.path.length;i++)
{
  dir = execSync(`cd / ; tree -Rfi ${parsed.path[i]} | grep -E *'(${frmts})';`)
  paths=paths+String(dir)
}
pth=paths.split('\n')
pth.pop()
console.log(pth.length)



/*var fth=''
for(var p=0;p<pth.length;p++)
{
	fth=pth[p].substring(0,pth[p].length-3)+'jpg'
//	let met = execSync(`ffmpeg -i ${pth[p]} ${fth} -y`)
	fth=''
}*/

console.log('test3')
con.connect(function(err) {
	for(let i=0;i<pth.length;i++)
	{
		mi({maxBuffer:1.797693134862315E+308},pth[i]).then(function(data) {
			dta=data[0]
			console.log("\n")
			tname=artists=genre=dur=bit=rdate='NULL'
			alname='\'Unknown\''
			//value(dta);
			if(dta['general']['recorded_date']!=undefined)
				rdate='\''+parseInt(dta['general']['recorded_date']).toString()+'-01-01\''

			if(dta['general']['duration']!=undefined)
				dur=parseInt(dta['general']['duration'][0]/1000)

			if(dta['general']['overall_bit_rate']!=undefined)
				bit=parseInt(dta['general']['overall_bit_rate'][0]/1000)


			if(dta['general']['title']!=undefined)
				tname='\''+dta['general']['title']+'\''
			else
				tname='\''+dta['general']['file_name']+'\''


			if(dta['general']['performer']!=undefined && dta['general']['composer']!=undefined)
				artists='\''+dta['general']['performer']+' '+dta['general']['composer']+'\''
			else if(dta['general']['performer']==undefined && dta['general']['composer']!=undefined)
				artists='\''+dta['general']['composer']+'\''
			else if(dta['general']['performer']!=undefined && dta['general']['composer']==undefined)
				artists='\''+dta['general']['performer']+'\''


			if(dta['general']['genre']!=undefined)
				genre='\''+dta['general']['genre']+'\''

			if(dta['general']['album']!=undefined)
				alname='\''+dta['general']['album']+'\''

			var q1 = `INSERT INTO track (name,tpath,genre,artists,duration,bitrate,exist,aname,track_no) VALUES (${tname},'${pth[i]}',${genre},${artists},${dur},${bit},1,${alname},1)`;
			var q2=`INSERT INTO albums SET name=${alname},rdate=${rdate},num_tracks=1 ON DUPLICATE KEY UPDATE num_tracks=num_tracks+1`
			var q3=`UPDATE track SET exist=exist+1 WHERE tpath='${pth[i]}'`
			var q4=`UPDATE track t,albums a SET t.track_no=a.num_tracks WHERE t.tpath='${pth[i]}' AND t.aname=a.name`

			con.query(q1, function (err, result) {
				if(!err)
				{
					console.log('1 track inserted')
					con.query(q2, function (errr, result) {
					//if (errr) throw errr;
					console.log("1 album record inserted");
					});
					con.query(q4, function (errr, result) {
					console.log("update track_no");
					});
				}
				else
				{
					con.query(q3, function (err, result) {
					if (err) {console.log('add exist+1');throw err;}
					console.log("add exist+1");
					});
				}
			});

		}).catch(function (e){console.log('at catch');console.error(e)});//end of medio-info function
	}//end of for loop

	console.log('test4')
	var q5='UPDATE track t,albums a SET t.album_id=a.album_id WHERE t.aname=a.name'
	var q6='UPDATE track t,albums a SET a.num_tracks=a.num_tracks-1 WHERE t.exist=0 AND t.album_id=a.album_id'
	var q7='DELETE FROM albums WHERE num_tracks=0'
	var q8='DELETE FROM track WHERE exist=0'
	var q9='UPDATE track SET exist=0'

	con.query(q5, function (err, result) {
		if (err) {console.log('album_id');throw err;}
		console.log('album_id')
	})
	con.query(q6, function (err, result) {
		if (err) {console.log('tracks -1');throw err;}
		console.log('tracks -1')
	})
	con.query(q7, function (err, result) {
		if (err) {console.log('deletion album');throw err;}
		console.log('deletion album')
	});
	con.query(q8, function (err, result) {
		if (err) {console.log('deletion track');throw err;}
		console.log('deletion track')
	});
	con.query(q9, function (err, result) {
		if (err) {console.log('updating exist');throw err;}
		console.log('updating exist')
	});
})//end of database connection
