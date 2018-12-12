const config = require('./config');
const mysql = require('mysql');
const creds = require('./auth_details')

sql = {
host	: creds.sql.host,
user	: creds.sql.user,
password: creds.sql.password,
database: 'divesong'
}


 async function main(){
	 async function getTokens(){
		 return new Promise(function(resolve, reject) {
			 connection = mysql.createConnection(sql);
			 connection.query(`select auth_token, tme from authenticate`,(err,result)=>{
				 if(err){
					 console.error(err);
					 resolve(undefined);
				 }
				 resolve(result);
			 })
		 });
	 }
	 async function deleteToken(auth_token){
		 return new Promise(function(resolve, reject) {
			 connection = mysql.createConnection(sql);
			 connection.query(`delete from authenticate where auth_token='${auth_token}'`,(err,result)=>{
				 if(err){
					 console.error(err);
					 resolve(undefined);
				 }
				 resolve(result);
			 })
		 });
	 }
	 tokenList = await getTokens()
	 if(tokenList===undefined){
		 return 0;
	 }
	 for (i in tokenList){
		 if(new Date()>new Date(tokenList[i].tme.getTime() + 30*24*60*60*1000)){
			 console.log(tokenList[i]);
			 result = await deleteToken(tokenList[i].auth_token)
			 if(result == undefined){
				 console.log("Not able to delete token");
			 }
			 else {
			 	console.log("Token Deleted!")
			 }

		 }

	 }

	 process.exit()
	 return 0;
 }
main()
