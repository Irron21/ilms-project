const bcrypt = require('bcryptjs');

const password = 'password123';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error(err);
    } else {
        console.log('YOUR REAL HASH IS BELOW:');
        console.log(hash);
    }
});