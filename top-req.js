var mysql = require('mysql');
let creds = require('./auth_details')

var cred={
  host: creds.sql.host,
  user: creds.sql.user,
  password: creds.sql.password,
  database: "divesong"
}

var sql = mysql.createConnection(cred);

var top_request=[]

sql.connect(async function(err){
		var q1 = `SELECT * FROM req_list ORDER BY num_req DESC,rtime DESC`
		var q2 = `SELECT max(ind) from next_tracks`
		var q3 = `SELECT min(ind) from next_tracks`
		var q4 = `SELECT count(ind) from next_tracks`
		var q5 = `UPDATE next_tracks SET ind=ind+1`
		async function top_req()
		{
			return new Promise(function(resolve,reject){
				sql.query(q1, function (err, result) {
					if (err) {console.log('add request err');throw err;}
					console.log("add request");
					resolve(result)
				});
			});
		}
		top_request=await top_req()
		top_request=top_request.slice(0,3)
		console.log(top_request)
		async function max_nxtreq()
		{
			return new Promise(function(resolve,reject){
				sql.query(q2, function (err, result) {
					if (err) {console.log('max next_tracks err');throw err;}
					console.log(result);
					resolve(result)
				});
			});
		}
		async function min_nxtreq()
		{
			return new Promise(function(resolve,reject){
				sql.query(q3, function (err, result) {
					if (err) {console.log('min next_tracks err');throw err;}
					console.log(result);
					resolve(result)
				});
			});
		}
		async function count_nxtreq()
		{
			return new Promise(function(resolve,reject){
				sql.query(q4, function (err, result) {
					if (err) {console.log('max next_tracks err');throw err;}
					console.log(result);
					resolve(result)
				});
			});
		}
		async function update_nxtreq()
		{
			return new Promise(function(resolve,reject){
				sql.query(q5, function (err, result) {
					if (err) {console.log('update next_tracks err');throw err;}
					console.log(result);
					resolve(result)
				});
			});
		}
		max_temp=await max_nxtreq()
		max=max_temp[0]['max(ind)']
		console.log(max)
		if(max==='null'){max=0}
		count_temp=await count_nxtreq()
		count=count_temp[0]['count(ind)']
		for(var i=0;count<=3;i++)
		{
			var q6 = `INSERT INTO next_tracks (ind,tid) VALUES (${max}+${i}+1,${top_request[i].tid})`
			async function add_nxtreq()
			{
				return new Promise(function(resolve,reject){
					sql.query(q6, function (err, result) {
						if (err) {console.log('add next_tracks err');throw err;}
						console.log(result);
						resolve(result)
					});
				});
			}
			add=await add_nxtreq()
			count_temp=await count_nxtreq()
		}
		min_temp=await min_nxtreq()
		min=min_temp[0]['min(ind)']
		if(min===2){update=await update_nxtreq()}
});
