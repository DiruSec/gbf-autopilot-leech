const fs = require('fs');
const path = require('path');
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

exports = module.exports = (
  env,
  config,
  server,
  logger,
  requireCore,
  run,
  exec
) => () => {
  const DefaultPipeline = requireCore('pipelines/Default');

  const CheckTreasure = requireCore('steps/Quest/CheckTreasure');
  const RefillBP = requireCore('steps/Quest/RefillBP');

  const Viramate = requireCore('steps/Viramate');
  const Location = requireCore('steps/Location');
  const Timeout = requireCore('steps/Timeout');
  const Element = requireCore('steps/Element');
  const Check = requireCore('steps/Check');
  const Click = requireCore('steps/Click');
  const Stop = requireCore('steps/Stop');
  const Wait = requireCore('steps/Wait');

  const queue = new Queue(100);

  const configPath = path.resolve(server.rootDir, config.General.Config);
  const leechConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const raidTimeout = leechConfig['Raid.Timeout'];
  const bosses = leechConfig['Raid.Bosses'];
  if ($stream) destroyStream();

  process.nextTick(() => {
    $stream = raidfinder.stream(bosses, (err, tweet, stream) => {
      if (err) {
        queue.throw(err);
        if (stream != $stream) stream.destroy();
        destroyStream();
      } else {
        queue.push(tweet);
      }
    });
  });

  env.partyGroup = leechConfig['Party.Group'];
  env.partyDeck = leechConfig['Party.Deck'];
  env.partySet = leechConfig['Party.Set'];
  env.summonPreferred = leechConfig['Summon.Preferred'];
  env.summonAttribute = leechConfig['Summon.Attribute'];
  env.summonReroll = leechConfig['Summon.Reroll'];
  env.luaScript = leechConfig['Lua.Script'];
  env.questMax = 1;

  const enterBattle = steps =>
    exec([
      Wait('.atx-lead-link'),
      () => exec(DefaultPipeline()),
      () => exec(steps)
    ]);

  const waitToFinish = steps => exec([Timeout(raidTimeout), () => exec(steps)]);

  const clearPendingBattle = () =>
    exec([
      Element.Attributes('.btn-multi-raid.lis-raid', 'data-href'),
      (context, attrs) =>
        new Promise((resolve, reject) => {
          run(Location.Wait('result_multi')).then(resolve, reject);
          run(Location.Change('#' + attrs['data-href'])).then(noop, reject);
        }),
      Wait('.pop-usual.pop-exp'),
      Click.Condition('.btn-usual-ok'),
      Timeout(3000)
    ]);

  const checkPendingBattles = steps =>
    exec([
      Location.Change('#quest/assist/unclaimed'),
      Wait('.atx-lead-link'),
      () =>
        run(Check('.btn-multi-raid.lis-raid')).then(() => true, () => false),
      (context, hasUnclaimed) => {
        if (hasUnclaimed) {
          return clearPendingBattle().then(() => checkPendingBattles(steps));
        } else {
          return exec(steps);
        }
      }
    ]);

  const refillBP = steps =>
    exec([
      // TODO: fill BP accordingly to raid requirement
      RefillBP(5),
      () => exec(steps)
    ]);

  const checkJoinResult = (result, steps) => {
    if (result === 'ok') {
      return enterBattle(steps);
    } else if (result.indexOf('provide backup') >= 0) {
      return waitToFinish(steps);
    } else if (result.indexOf('pending') >= 0) {
      return checkPendingBattles(steps);
    } else if (result.indexOf('refill') >= 0) {
      return refillBP(steps);
    } else {
      logger.error('Unknown join raid status:', result);
      return false;
    }
  };

  const startLeech = steps =>
    exec([
      () => (env.questCount = 0),
      () => queue.fetch(),
      (context, tweet) =>
        new Promise((resolve, reject) => {
          const options = { type: 'tryJoinRaid', raidCode: tweet.raid.code };
          run(Viramate(options))
            .then(result => checkJoinResult(result, steps))
            .then(resolve, reject);
        })
    ]);

  const checkTreasure = steps =>
    run(CheckTreasure()).then(hasReachedTarget => {
      if (hasReachedTarget) {
        logger.info('Treasure target reached. Stopping...');
        return run(Stop());
      }
      return startLeech(steps);
    });

  const steps = [() => checkTreasure(steps)];
  return steps;
};
exports.test = config => config.General.Mode === 'Leech';
exports['@name'] = 'Leech';
exports['@require'] = [
  'env',
  'config',
  'server',
  'logger',
  'require',
  'run',
  'process'
];
