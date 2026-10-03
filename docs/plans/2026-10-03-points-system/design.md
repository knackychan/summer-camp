# Summer Quest points system

**Status:** Direction accepted by Papa on 2026-10-03. Points implementation and migration scripts are implemented and tested locally; live database deployment is pending. See the implementation record for completed checks. Currency and budget remain unset until Papa configures them; cash is disabled by default.
**Scope:** Replace the visible Stars / Quest Coins economy with Points, suggest activity awards, and define an easy future gift or cash conversion.
**Implementation:** [01-points-and-redemption.md](01-points-and-redemption.md).

## 1. One currency, two useful totals

Call the currency **Points / 點數** everywhere. Use whole numbers, normally in multiples of 5.

- **Available points / 可用點數:** confirmed earnings minus approved redemptions; the amount a child can spend.
- **Total earned / 累積獲得:** earnings used for achievements and progress. Buying a reward does not lower it.
- Offline earnings appear immediately as **Pending sync / 待同步** and become spendable once confirmed. Parent verification, when required, comes before earnings are confirmed.
- Game scores, accuracy, vocabulary mastery and placement results remain separate learning measurements. They are not exchangeable points.

Suggested starting pace: **100–150 points on an active day**, with optional activities rather than a requirement to complete every row below. This is a design target, not a measured forecast or hard earning limit.

## 2. Suggested awards

Award a completed, agreed task. The child sees its value before starting. Approximate durations describe the task; they do not pay points per minute or require surveillance timers.

| Activity | Points | Completion and limit |
|---|---:|---|
| Morning Teeth | 5 | Once each morning |
| Evening Teeth | 5 | Once each evening |
| Get dressed and make the bed | 5 | Once daily; suitable help is allowed |
| Shower Quest | 5 | Once daily |
| Table Helper | 5 | One useful set/clear/wipe job per meal; maximum 3 awards daily |
| Plant Patrol | 10 | Once on its scheduled day; checking damp soil counts, unnecessary watering does not |
| Room Rescue | 10 | Agreed tidy-up, checked by a parent; once daily |
| Laundry Helper | 15 | One agreed batch sorted/folded/put away, parent checked; once daily |
| Extra housework or helping cook | 20 | One distinct parent-assigned job daily; cannot repeat an already paid table/laundry/room task |
| Reading Nest / scheduled reading | 20 | An age-appropriate reading or listening goal, then share a favourite part; once daily |
| Each assigned Brain Gym exercise | 10 | First completion of each of today's 3 assigned exercises: **30 total**; no additional trio bonus |
| Homework | 30 | Finish the day's agreed work, including supported corrections; parent checked; once daily |
| Guided learning or skill practice | 20 | Finish a defined session; maximum 2 separately assigned sessions daily across these subjects |
| Move Mission / physical activity | 20 | One agreed movement activity, adapted to ability; once daily |
| Make Something | 20 | Finish and show one drawing, craft, model or invention; once daily |
| Photo/video mission | 15 | Complete the agreed theme or small photo set and show it; once daily |
| Music practice | 15 | Complete an agreed song, rhythm or exercise on piano, synth or pads; once daily |
| Help a sibling / Captain help | 10 | One distinct helpful action, parent confirmed; once daily |
| Family outing | 20 | One parent-agreed active or learning goal during the outing; once daily; replaces the movement/learning award for the same work |
| Weekly craft, build or research project | 50 total | Parent-agreed milestone, once weekly; replaces the smaller award for the same work |
| Free play, arcade replays, world toys, idle time | 0 | Keep game scores, bests and celebrations |
| Placement / calibration | 0 | Keep assessment independent of reward earning |
| Meals, naps, screen-time blocks, simply opening a guide | 0 | Schedule tracking can still record these |

**Guided learning** includes the existing math, English/vocabulary, Chinese, science, geography and history sessions; typing practice; a Solar System learning task; and a Learn-guide research task. Completing a defined task matters, not a perfect score, typing speed or number of clicks. A Brain Gym or homework session cannot also claim this award.

**Brain Gym:** Calculations, Sign Finder, Low to High, Color Words, Number Bonds, Time Lapse, Change Maker, Word Memory and Math Recall each use the same 10-point rule when assigned in the daily trio. Extra practice remains available without additional spendable points.

**Activity Bank mapping:** Roof Gym, Boxing Bag, Outdoor and Active Screen all use the single daily movement award. Desk Creative and Boredom → Creativity use Make Something. Weekly Craft uses the project award. Photo & Video uses the photo award. Computer/AI/Web uses a specific learning or creative task. House Help uses the relevant chore. Minecraft uses Make Something only for a parent-agreed build that is shown afterwards; ordinary play pays 0.

**Games:** Big Machines, Monster Truck, Dig Site and Kitchen Quest remain free play. Balloon Pop, Key Hunt, Home Row, Word Racer, Orc Attack and Word Wizard can support an assigned skill session; playing arbitrary rounds does not pay. Paint & Colour can satisfy Make Something. Instruments can satisfy music practice. Opening any of these through Quests, My Day, Games or the world must resolve to the same award for the same work.

For a 50-point project, a previously paid 20-point creative milestone leaves **30 points** at final approval, not another 50. Agree the milestone and total before the work starts.

Parent manual awards use quick buttons **+5 / +10 / +20** and a custom amount with a required reason. Use these for a distinct contribution or a correction, without paying again for an already rewarded task. A pass or outing schedule override does not automatically mint points for every covered block.

## 3. Bonuses that encourage a varied day

- **Balanced day: +20 points**, once daily, after one learning task, one helping task and one movement task. Reading or an assigned Brain exercise qualifies as learning; one table job qualifies as helping. A parent may excuse an unavailable category, for example during illness.
- **Four balanced days in a week: +50 points**, once per Monday–Sunday week in Asia/Taipei. Days need not be consecutive. This replaces any proposed streak multiplier.
- No point loss for mistakes, asking for help, missed days or using an excused pass. Spending and correcting an accidental duplicate are bookkeeping, not punishments.
- The balanced-day bonus replaces the current all-schedule-complete bonus; they do not stack. Optional screen/rest blocks are not bonus prerequisites.

### Fairness for the three children

Use the existing ages/difficulty adaptations: Lucien 4, Lili 7 and Luis 9. Give the **same points for comparable personal effort**, with different goals. For reading, Lucien might listen to a picture book and describe a picture; Lili might read a short passage; Luis might read a chapter and share a summary. Help and mistakes do not reduce the award. Do not use sibling rankings or age multipliers.

### Example active day

| Completed | Points |
|---|---:|
| Four care routines: teeth morning/evening, dressing/bed, shower | 20 |
| Three meal helper jobs | 15 |
| Daily Brain Gym trio | 30 |
| Reading | 20 |
| Movement | 20 |
| Balanced-day bonus | 20 |
| **Total** | **125** |

Homework or a project can replace some optional activities or make a higher-earning day. Completing the whole catalog is not the target.

## 4. Gifts and money

Currency and budget are undecided. Keep one parent-controlled conversion rate; show cash equivalents only after Papa enables them. The following is an **illustration in New Taiwan dollars**, not an exchange-rate claim or a commitment to pay.

**Example rate: 10 points = NT$1; 1,000 points = NT$100.**

```text
gift cost in points = agreed gift value in NT$ × 10
cash value in NT$ = redeemed points ÷ 10
```

For cash, redeem in 100-point steps (NT$10). Leave smaller balances intact. For a gift with a fractional currency price, round its point cost up to the next 5 points and show the price before requesting it. Parent-set experience rewards need no retail price.

| Reward | Suggested cost |
|---|---:|
| Choose the family movie | 200 points |
| Choose a special breakfast | 250 points |
| Choose dessert within the family budget | 300 points |
| NT$50 gift contribution or cash | 500 points |
| NT$100 gift contribution or cash | 1,000 points |
| NT$300 gift contribution or cash | 3,000 points |
| Special outing | Parent prices it before it appears in the shop |

These are proposed prices for future requests. Existing rewards and outstanding requests must first retain their value during migration; any later repricing is shown explicitly.

### Admin exchange labels

Papa can change each exchange name, such as “Choose the family movie” or “NT$100 gift contribution,” in **Admin → Quests → Rewards → Edit**. Provide **Exchange label (English)** and **Exchange label (Traditional Chinese)** alongside the existing description, icon, cost and availability controls.

Reuse the reward catalog's bilingual `title` field. The child shop and new requests use those saved names. Editing a name preserves the reward ID, balance and cost; changing the cost is a separate edit. Labels are plain text and rendered with HTML escaping. The existing editor already saves these values to `family_settings`; its controls now explicitly name the exchange label. No second label setting is needed.

At 125 points × 30 active days plus four weekly bonuses, a child earns **3,950 points = NT$395** at the example rate. Three children would earn **NT$1,185** in total. Actual totals depend on completed tasks. At 100–150 points/day plus four weekly bonuses, the corresponding range is NT$320–470 per child.

Suggested starting redemption budget, if this currency is chosen: **NT$500 per child per month across paid gifts and cash combined**. A parent can set a different amount. Budget exhaustion postpones redemption and shows when it reopens; it does not delete points. Separate existing savings and the initial conversion from estimates of newly earned monthly points.

To choose another rate from a budget:

```text
points per currency unit = expected monthly points ÷ desired monthly reward value
```

Use this as a planning estimate, then choose a simple rate and state a redemption budget. Do not quietly devalue saved points when tuning the system; change future awards or announce an explicit transition.

## 5. Earning and spending rules

1. One real activity has one award identity. My Day, Quests, the Activity Bank and a game result cannot each pay for the same completion. Combined schedule blocks record their component tasks without creating another flat block award.
2. Reopening, re-ticking, reconnecting or completing the same task on another tablet cannot pay twice. Apply daily limits in Asia/Taipei.
3. A bare “I did it” on the Activity Bank or Learn guide still does not mint money-equivalent credit. Use an actual in-app completion where available; otherwise parent verification. Care routines may remain self-checked within their small fixed limits.
4. A child requests a reward; a parent approves it. Record the requested item, point price and conversion rate. Later catalog edits must not silently change that request's price.
5. Approval checks the confirmed balance and monthly redemption budget, then records the deduction and approved request together exactly once. Two parent devices must not overspend the same balance.
6. Keep a readable history of earnings, pending verification/sync, redemptions and any corrections. Declining a request does not deduct points. If an approved reward cannot be delivered, record one refund and retain the original history.
7. Points do not expire, and a new summer/season does not reset unspent points. Progress displays and reward balances use the appropriate total.

## 6. Preserve existing value

Suggested transition: **1 existing star / Quest Coin = 10 points**. Stars and coins currently describe the same earnings, so do not add them together.

Example: 80 lifetime stars with 20 coins previously spent becomes **800 total earned, 200 spent, 600 available**. A current 12-coin reward initially becomes 120 points. New activity amounts above apply prospectively.

Convert existing earnings, spending, reward costs, outstanding request prices and achievement thresholds consistently. Preserve all ledger history and request IDs. Cached totals, pending offline earnings and tablets still sending old units need explicit compatibility handling; multiplying the screen number alone is insufficient. Converted saved balances may exceed the example monthly budget and remain available for future months.

## 7. Findings in the current app

- `js/star-id.js`: every known routine/mission block currently pays 1 star; full-day bonus is 2. The schedule has 16 blocks, including rest and screens.
- `js/quest-data.js`: most routine/chore/activity quests separately pay 1, with Brain Sprint and Game Adventure paying 0. Several overlap schedule activities.
- `index.html`: the complete daily Brain trio pays 1; self-claimed Activity Bank and Learn-guide completion intentionally pay 0.
- `js/quest-config.js`: wallet already derives from earned stars minus approved spending. Reuse that distinction.
- `js/admin.js`: reward approval saves the spending total and answers the request in separate client writes. Real gift/cash redemption needs atomic approval.
- `supabase/schema.sql`: app ledger inserts currently accept only deltas 1–3; coordinated schema, client and offline-unit migration is necessary.
- Season-reset SQL currently clears both earnings and spending. The new persistent wallet contract requires changing that behavior before enabling redeemable points.

This design did not change live balances or settings. The implementation record distinguishes local code/tests from database deployment.
