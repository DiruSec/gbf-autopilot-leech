const Raidfinder = require('gbf-raidfinder');
const Queue = require('./queue');
const raidfinder = new Raidfinder();
const noop = () => {};
var $stream;

function destroyStream() {
  if (!$stream) return;
  $stream.destroy();
  $stream = null;
}

exports = module.exports = (env, config, requireCore, run, exec) => () => {
  const DefaultPipeline = requireCore('pipelines/Default');
  const Viramate = requireCore('steps/Viramate');
  const Location = requireCore('steps/Location');
  const Wait = requireCore('steps/Wait');
  const queue = new Queue(100);

  const tracked = config.Leech.TrackedRaids.split(',');
  if ($stream) destroyStream();

  process.nextTick(() => {
    $stream = raidfinder.stream(tracked, (err, tweet, stream) => {
      if (err) {
        queue.throw(err);
        if (stream != $stream) stream.destroy();
        destroyStream();
      } else {
        queue.push(tweet);
      }
    });
  });

  env.partyGroup = config.Leech.PartyGroup;
  env.partyDeck = config.Leech.PartyDeck;
  env.partySet = config.Leech.PartySet;
  env.summonPreferred = config.Leech.PreferredSummons;
  env.summonAttribute = config.Leech.DefaultSummonAttributeTab;
  env.summonReroll = config.Leech.RerollSummonWheNoPreferredSummonWasFound;
  env.luaScript = config.Leech.LuaScript;
  env.questMax = 1;

  const steps = [
    () => (env.questCount = 0),
    () => queue.fetch(),
    (context, tweet) =>
      new Promise((resolve, reject) => {
        const options = { type: 'tryJoinRaid', raidCode: tweet.raid.code };
        run(Location.Wait()).then(resolve, reject);
        run(Viramate(options)).then(noop, reject);
      }),
    Wait('.atx-lead-link'),
    () => exec(DefaultPipeline()),
    () => exec(steps)
  ];
  return steps;
};
exports.test = config => config.General.Mode === 'Leech';
exports['@name'] = 'Leech';
exports['@require'] = ['env', 'config', 'require', 'run', 'process'];
