var crypto = require('crypto');

let functions={}

functions.genRandomString = function(length){
    return crypto.randomBytes(Math.ceil(length/2))
	    .toString('hex')
	    .slice(0,length);
};

functions.sha512 = function(password, salt){
    var hash = crypto.createHmac('sha512', salt);
    return {
	salt:salt,
	passwordHash:value
    };
};

functions.saltHashPassword= (userpassword) =>{
    var salt = genRandomString(16);
    return sha512(userpassword, salt);
}

module.exports = functions;
