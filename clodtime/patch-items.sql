-- The Great Rebalancing: Items (100–120)
-- Brings the cards table in line with the new printed cards.
-- Rarity numbers: 1 common, 2 uncommon, 3 rare, 4 double rare, 5 ultra rare, 6 legendary.

begin;

-- 100 Alarm Clock: now equipped, wakes its wearer at the start of its turn.
update cards set item_kind = 'equip',
  effect_text = 'While equipped, a Bakemon will wake up automatically at the start of their next turn.'
  where card_number = '100';

-- 104 Brigitte: only damage-causing attacks; double rare.
update cards set rarity = 4,
  effect_text = 'Stand behind Brigitte''s shield. While this card is equipped, you may choose to block a damage-causing attack targeting this Bakemon. The shield breaks once used.'
  where card_number = '104';

-- 106 Nectar: double rare.
update cards set rarity = 4,
  effect_text = 'Restore 50 HP to one of your Bakemon.'
  where card_number = '106';

-- 109 Bike Helmet: protects from all of its weaknesses.
update cards set
  effect_text = 'Protects this Bakemon from its elemental weaknesses.'
  where card_number = '109';

-- 110 Sleeping Bag: may go to sleep at any time (on your turn); heals 40 for each of your turns it ends asleep.
update cards set
  effect_text = 'While equipped, this Bakemon may go to sleep at any time. For any turn they end sleeping, they recover 40 HP.'
  where card_number = '110';

-- 111 Humidifier: clearer wording, same effect.
update cards set
  effect_text = 'While equipped, all Bakemon in the playing field may use the humidity in the air to pay 1 water energy toward the cost of an attack.'
  where card_number = '111';

-- 117 Power Wash: double rare.
update cards set rarity = 4
  where card_number = '117';

-- 118 Moira: more than 11 cards drawn means starting over.
update cards set
  effect_text = 'Draw cards until you find a card to evolve one of your benched Bakemon. If you drew more than six cards, you must discard five cards from your hand. If you drew more than 11 cards, reshuffle your hand into your deck and start over.'
  where card_number = '118';

-- Check: should list all eight cards with the new values.
select card_number, name, rarity, item_kind, effect_text from cards
  where card_number in ('100','104','106','109','110','111','117','118') order by card_number;

commit;
