'use strict'
var mi = require('mediainfo-wrapper')
var mysql = require('mysql');
var execSync = require('child_process').execSync;
let creds = require('./auth_details')



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

var sql = {
  host: creds.sql.host,
  user: creds.sql.user,
  password: creds.sql.password,
  database: "divesong"
};


let parsed = require('./parser.js')

parsed.formats.forEach((x)=>{frmts=frmts+"\\."+x+"$|"})
frmts=frmts.substring(0,frmts.length-1)

let dir = '';
for(var i=0;i<parsed.path.length;i++)
{
  dir = execSync(`cd / ; tree -Rfi ${parsed.path[i]} | grep -E *'(${frmts})';`)
  paths=paths+String(dir)
}
pth=paths.split('\n')
pth.pop()
console.log(pth.length)

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
				connection.end()
				resolve(result)
			}
		})
	})
}

var fth=[]
for(var p=0;p<pth.length;p++)
{
	fth[p]=pth[p].substring(0,pth[p].length-3)+'jpg'
	try
	{
		let met = execSync(`ffmpeg -i "${pth[p]}" "${fth[p]}" -y`)
		fth[p]='\''+pth[p].substring(0,pth[p].length-3)+'jpg\''
	}
	catch(e)
	{
		fth[p]='NULL'
	}
}

async function main(){
	var result
	for(let i=0;i<pth.length;i++)
	{
		console.log(pth[i]);
		;
		mi({maxBuffer:1.797693134862315E+308},pth[i]).then(async function(data) {
			dta=data[0]
			console.log("\n")
			tname=artists=genre=dur=bit=rdate='NULL'
			alname='\'Unknown\''
			//value(dta);
			if(dta['general']['recorded_date']!=undefined)
				rdate='\''+parseInt(dta['general']['recorded_date']).toString()+'-01-01\''

			if(dta['general']['duration']!=undefined)
				dur=parseInt(dta['general']['duration'][0]/1000)
			else {
				var tmp=execSync(`ffmpeg -i ${pth[i]} 2>&1 | grep Duration | awk '{print $2}' | tr -d ,`)
				if(tmp!=undefined)
				{
					tmp=String(tmp)
					tmp=tmp.substring(0,tmp.length-1).split(':')
					dur = parseInt(tmp[2])+tmp[1]*60+tmp[0]*60*60
				}
				else if(dur==undefined || isNaN(dur)) {
					dur='NULL'
				}
			}

			if(dta['general']['overall_bit_rate']!=undefined)
				bit=parseInt(dta['general']['overall_bit_rate'][0]/1000)
			else
			{
				bit=parseInt(execSync(`ffmpeg -i ${pth[i]} 2>&1 | grep bitrate | awk '{print $6}'`))
				if(bit==undefined || isNaN(bit))
					bit='NULL'
			}

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

			var q1 = `INSERT INTO track (name,tpath,genre,artists,duration,bitrate,exist,aname,track_no,imgpath) VALUES (${tname},'${pth[i]}',${genre},${artists},${dur},${bit},1,${alname},1,${fth[i]})`;
			var q2=`INSERT INTO albums SET name=${alname},rdate=${rdate},num_tracks=1 ON DUPLICATE KEY UPDATE num_tracks=num_tracks+1`
			var q3=`UPDATE track SET exist=exist+1 WHERE tpath='${pth[i]}'`
			var q4=`UPDATE track t,albums a SET t.track_no=a.num_tracks WHERE t.tpath='${pth[i]}' AND t.aname=a.name`

			result = await runQuery(q1,"",'1 track inserted')
			if(result)
			{
				result = await runQuery(q2,"","1 album record inserted");
				result = await runQuery(q4,"","update track_no");
			}
			else
			{
				result = await runQuery(q3,'add exist+1','add exist+1')
			}


		}).catch(function (e){console.log('at catch');console.error(e)});//end of medio-info function
	}//end of for loop

	var q5='UPDATE track t,albums a SET t.album_id=a.album_id WHERE t.aname=a.name'
	var q6='UPDATE track t,albums a SET a.num_tracks=a.num_tracks-1 WHERE t.exist=0 AND t.album_id=a.album_id'
	var q7='DELETE FROM albums WHERE num_tracks=0'
	var q8='DELETE FROM track WHERE exist=0'
	var q9='UPDATE track SET exist=0'

	result = await runQuery(q5,"album_id","album_id");
	result = await runQuery(q6,'tracks -1','tracks -1')
	result = await runQuery(q7,'deletion album','deletion album')
	result = await runQuery(q8,'deletion track','deletion track')
	result = await runQuery(q9,'updating exist','updating exist')
}//end of database connection
main()
