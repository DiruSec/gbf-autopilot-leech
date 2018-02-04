const path = require('path');
const dotenv = require('dotenv');
const pipeline = require('./pipeline');

module.exports = function server() {
  dotenv.config();
  this.coreExtension.pipelines.push(pipeline);
  this.coreExtension.scripts.push(path.resolve(__dirname, 'lua/combat.lua'));
};
