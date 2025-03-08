const bcrypt = require('bcrypt');
const saltRounds = 10;
const password = 'password';

bcrypt.hash(password, saltRounds, function(err, hash) {
    console.log('Bcrypt Hash:', hash);
});