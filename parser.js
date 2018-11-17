'use strict';
var fs = require('fs');

let final={}
var data=fs.readFileSync("divesong.config")
let x=data.toString();
let lines=x.split("\n");
let clines=[]
x.split("\n").forEach(x=>{if(x[0]!='#' && x.trim().length)clines.push(x.trim())})
let nl=[]
let cnl=[]
let xnl=[]
for(x of clines)
	{
		nl=x.split('=')
		cnl=[]
		xnl=[]
		for(var i=0;i<nl.length;i++)
  		{
  	      		cnl.push(nl[i].trim());
  	      		if(cnl[1]!==undefined)
  	      			cnl[1].split(",").forEach((x)=>{xnl.push(x.trim())})
  	    		final[cnl[0]]=xnl
		}
		
  	}
  	//console.log(final)
  	
module.exports=final

