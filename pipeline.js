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
  scenarioConfig,
  server,
  worker,
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

  const raidTimeout = scenarioConfig.get('Raid.Timeout');
  const bosses = scenarioConfig.get('Raid.Bosses');

  if ($stream) destroyStream();
  const subscription = worker.on('stop', () => {
    if ($stream) destroyStream();
    subscription.unsubscribe();
  });

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

  env.partyGroup = scenarioConfig.get('Party.Group');
  env.partyDeck = scenarioConfig.get('Party.Deck');
  env.partySet = scenarioConfig.get('Party.Set');
  env.summonPreferred = scenarioConfig.get('Summon.Preferred');
  env.summonAttribute = scenarioConfig.get('Summon.Attribute');
  env.summonReroll = scenarioConfig.get('Summon.Reroll');
  env.luaScript = scenarioConfig.get('Lua.Script');
  env.questMax = 1;

  const enterBattle = steps =>
    exec([
      Wait('.atx-lead-link'),
      () =>
        exec(DefaultPipeline()).catch(err => {
          logger.warn(err);
          return false;
        }),
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
      Click.Condition('.btn-usual-ok,.btn-unclaimed'),

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
      logger.warn('Unknown join raid status:', result);
      return exec(steps);
    }
  };

  const startLeech = steps =>
    exec([
      () => (env.questCount = 0),
      () => {
        logger.info('Fetching tweet...');
        return queue.fetch();
      },
      (context, tweet) =>
        new Promise((resolve, reject) => {
          logger.info(tweet.boss.text, tweet.raid.code, tweet.raid.message);
          const options = {
            type: 'tryJoinRaid',
            raidCode: tweet.raid.code
          };
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
exports.test = (config, scenarioConfig) =>
  scenarioConfig.get('Mode') === 'Leech';
exports['@name'] = 'Leech';
exports['@require'] = [
  'env',
  'scenarioConfig',
  'server',
  'worker',
  'logger',
  'require',
  'run',
  'process'
];
