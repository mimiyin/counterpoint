const { recover } = require('./index');

try {
    recover();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
