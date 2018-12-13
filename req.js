var mysql = require('mysql');
let creds = require('./auth_details')
var mail  = require('./mail.js')

var sql={
  host: creds.sql.host,
  user: creds.sql.user,
  password: creds.sql.password,
  database: "divesong"
}

async function top_req()
{
	return new Promise(function(resolve,reject){
		reqst=[]
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT tid FROM req_list ORDER BY num_req DESC,rtime`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('add next_track from top req err');resolve(undefined);
			}
			console.log("add next_track from top req");
			//console.log(result[0])
			reqst=result
			resolve(reqst)
		});
		connection.end()
	});
}

async function exists(tid)
{
	if(tid == undefined)
	{
		return undefined;
	}
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT tid FROM next_tracks where tid=${tid}`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('check tid exists or not err');resolve(undefined);
			}
			console.log("check tid exists or not");
			if(result== undefined || result.length ==0 )
			{
				resolve(0)
			}
			else
			{
				resolve(1)
			}
		});
		connection.end()
	});
}

async function count_nxtreq()
{
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT count(ind) from next_tracks`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('max next_tracks err');resolve(undefined);
			}
			//console.log(result);
			if(result==undefined)
				return undefined
			count=result[0]['count(ind)']
			resolve(count)
		});
		connection.end()
	});
}

async function max_nxtreq()
{
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT max(ind) from next_tracks`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('max next_tracks err');resolve(undefined);
			}
			//console.log(result);
			if(result==undefined)
				return undefined
			max=result[0]['max(ind)']
			resolve(max)
		});
		connection.end()
	});
}


async function push()
{
	top_request=await top_req()
	console.log(top_request)
	if (top_request!==undefined) {
		max=await max_nxtreq()
		if(max==undefined || max<0 || max==null){max=0}
		if(max==3){return 0}
		count=await count_nxtreq()
		var i=0
		for(let row in top_request)
		{
			if(max+i+1==4)
				break;
			exist = await exists(top_request[row]['tid'])
			console.log(exist,top_request[row]['tid'])
			if(!exist)
			{
				async function add_nxtreq()
				{
					return new Promise(function(resolve,reject){
						var connection = mysql.createConnection(sql);
						console.log(`INSERT INTO next_tracks (ind,tid) VALUES (${max}+${i}+1,${top_request[row]['tid']})`)
						connection.query(`INSERT INTO next_tracks (ind,tid) VALUES (${max}+${i}+1,${top_request[row]['tid']})`, function (err, result) {
							if (err) {
								console.error(err)
								console.log('add next_tracks err');
							}
							//console.log(result);
							resolve(result)
						});
						connection.end()
					});
				}
				add=await add_nxtreq()
				i++
			}
		}
		return i;
	}
}


async function get_tid(ind)
{
	if(ind===undefined){
		return undefined;
	}
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT tid FROM next_tracks WHERE ind=${ind}`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('get tid of first index err');resolve(undefined);
				resolve(undefined)
				return 0;
			}
			if(result==undefined || result.length==0){
				resolve(undefined)
				return 0;
			}
			//console.log(result);
			tid_temp=result
			tid=tid_temp[0]['tid']
			resolve(tid)
		});
		connection.end()
	});
}


async function pop()
{
	async function del_nxt()
	{
		//min=await min_nxtreq()
		gtid=await get_tid(1)
		if(gtid!==undefined)
		{
			return new Promise(function(resolve,reject){
				var connection = mysql.createConnection(sql);
				connection.query(`DELETE FROM next_tracks WHERE ind<=1`, function (err, result) {
					if (err) {
						console.error(err)
						console.log('delete first index after duration err');resolve(undefined);
					}
					console.log('delete first index after duration');
					resolve(gtid)
				});
				connection.end()
			});
		}
		else {
			return undefined;
		}
	}
	async function del_req(gtid)
	{
		if(gtid === undefined){
			console.log(`${gtid} is the tid `);
			return undefined;
		}
		else
		{
			return new Promise(function(resolve,reject){
				var connection = mysql.createConnection(sql);
				connection.query(`DELETE FROM req_list WHERE tid=${gtid}`, function (err, result) {
					if (err) {
						console.error(err)
						console.log('delete from request list err ');
						resolve(undefined)
					}
					console.log('delete from request list');
					resolve(result)
				});
				connection.end()
			});
		}
	}
	async function del_uhis(gtid)
	{
		if(gtid===undefined)
		{
			return undefined;
		}
		else
		{
			return new Promise(function(resolve,reject){
				var connection = mysql.createConnection(sql);
				connection.query(`DELETE FROM uhistory WHERE to_oper=0 and tid=${gtid}`, function (err, result) {
					if (err) {
						console.error(err)
						console.log('delete the request in user history err');resolve(undefined);
					}
					console.log('delete the request in user history err');
					resolve(result)
				});
				connection.end()
			});
		}
	}
	delete_next_tracks=await del_nxt()
	delete_req_list=await del_req(delete_next_tracks)
	delete_uhistory=await del_uhis(delete_next_tracks)
	await update_nxtreq();
}

async function update_nxtreq()
{
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		connection.query(`UPDATE next_tracks SET ind=ind-1`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('update next_tracks err');resolve(undefined);
			}
			//console.log(result);
			resolve(0)
		});
		connection.end()
	});
}


async function trk_history()
{
    curtime=new Date()
	curtime=curtime.toISOString().replace('T',' ').replace('Z','')
	//min=await min_nxtreq()
	tid=await get_tid(1)
	if(tid===undefined){
		return undefined;
	}
	else
	{
		return new Promise(function(resolve,reject){
			var connection = mysql.createConnection(sql);
			connection.query(`INSERT INTO thistory (tid,lplayed) VALUES (${tid},'${curtime}')`, function (err, result) {
				if (err) {
					console.error(err)
					console.log('insert thistory err')
					resolve(undefined)
				}
				//console.log(result);
				resolve(tid)
			});
			connection.end()
		});
	}
}

async function get_tids()
{
	return new Promise(function(resolve,reject){
		reqst=[]
		var connection = mysql.createConnection(sql);
		connection.query(`SELECT tid FROM next_tracks ORDER BY ind`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('get tids err');resolve(undefined);
			}
			console.log("get tids");
			if(result==undefined)
			{
				resolve(undefined)
			}
			//console.log(result[0])
			reqst=result
			resolve(reqst)
		});
		connection.end()
	});
}


async function send_email(tid,uid)
{
	if(tid===undefined || uid ===undefined)
	{
		return undefined;
	}
	async function get_udetails()
	{
		return new Promise(function(resolve,reject){
			userdetail={}
			var connection = mysql.createConnection(sql);
			connection.query(`SELECT uname,email FROM users WHERE uid=${uid}`, function (err, result) {
				if (err) {
					console.error(err)
					console.log('get uname and email from users table err');resolve(undefined);
				}
				//console.log(result)
				if(result==undefined || result.length<=0)
				{
					resolve(undefined)
				}
				userdetail.uname=result[0]['uname']
				userdetail.email=result[0]['email']
				resolve(userdetail)
			});
			connection.end()
		});
	}
	async function get_trackname()
	{
		return new Promise(function(resolve,reject){
			var connection = mysql.createConnection(sql);
			connection.query(`SELECT name FROM track WHERE tid=${tid}`, function (err, result) {
				if (err) {
					console.error(err)
					console.log('get tname from track err');resolve(undefined);
				}
				tname=result[0]['name']
				console.log(result,tname)
				resolve(tname)
			});
			connection.end()
		});
	}
	userdetail=await get_udetails()
	tname=await get_trackname()
	console.log(userdetail,tname,'user and track details')
	if(userdetail===undefined || tname===undefined)
	{
		return undefined;
	}
	else
	{
		mailOptions={
			to:`${userdetail.email}`,
			subject:`DiveSong Song reminder - ${tname}`,
			html:`<h4>Hello ${userdetail.uname} ,</h4><br>&nbsp;&nbsp;<i>The track you requested ${tname} is going to be played in a few more minutes `
		}
		if(userdetail!==undefined || tname!==undefined)
		{
			console.log(mailOptions)
			mail.sendMail(mailOptions)
		}
	}
}

async function notify(no_mail)
{
	if(no_mail===undefined){
		no_mail=4;
	}
	gtid=await get_tids()
	if(gtid!==undefined)
	{
		for(let row in gtid)
		{
			async function get_userid(tid)
			{
				if(tid==undefined)
					return undefined
				else
				{
					return new Promise(function(resolve,reject){
						var connection = mysql.createConnection(sql);
						console.log(`SELECT uid FROM uhistory inner join ( select tid from next_tracks order by ind DESC limit ${no_mail}) as nt_id on nt_id.tid = uhistory.tid WHERE tid=${tid} AND to_oper=0`)
						connection.query(`SELECT uid FROM uhistory inner join ( select tid from next_tracks order by ind DESC limit ${no_mail}) as nt_id on nt_id.tid = uhistory.tid WHERE nt_id.tid=${tid} AND to_oper=0`, function (err, result) {
							if (err) {
								console.error(err)
								console.log('get uid from uhistory err');resolve(undefined);
							}
							//console.log(result)
							if(result==undefined || result.length<=0)
							{
								// connection.end()
								resolve(undefined)
							}
							else
							{
								resolve(result)
							}
						});
						connection.end()
					});
				}
			}
			uids=await get_userid(gtid[row]['tid'])

			for(let row2 in uids)
			{
				console.log(uids,'requested users',gtid[row]['tid'],uids[row2]['uid'])
				email=await send_email(gtid[row]['tid'],uids[row2]['uid'])
			}
		}
	}
}

async function get_duration()
{
	tid=await get_tids()
	if(tid===undefined ){
		return 1;
	}
	else if (tid.length==0){
		return 1;
	}
	return new Promise(function(resolve,reject){
		var connection = mysql.createConnection(sql);
		tid=tid[0]['tid']
		console.log(tid);
		connection.query(`SELECT duration FROM track WHERE tid=${tid}`, function (err, result) {
			if (err) {
				console.error(err)
				console.log('get duration of first index err');resolve(undefined);
			}
			//console.log(result);
			if(result ==undefined || result.length<=0)
			{
				// connection.end()
				resolve(1)
			}
			dur_temp=result
			dur=dur_temp[0]['duration']
			resolve(dur)
		});
		connection.end()
	});
}


function delay(secs){
	return new Promise(function(resolve, reject) {
		setTimeout(()=>{
			resolve(1)
		},secs*1000)
	});
}

async function main()
{
	while(1){

		push_result = await push()
		if(push_result){
			await notify(push_result)
		}
		trk_histry=await trk_history()

		dur=await get_duration()
		console.log('duration',dur)


		let dur_left = 0;
		for (dur_left=0;dur_left<=dur;dur_left++){
			await delay(1)

			push_result = await push()
			if(push_result){
				await notify(push_result)
			}
		}
		if(await top_req().length != 0 && dur > 1 ){
			await pop();
		}
	}	// req = require('./req');
}

main()
