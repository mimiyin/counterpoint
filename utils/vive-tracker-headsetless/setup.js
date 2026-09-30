const { setup } = require('./index');

try {
    setup();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
