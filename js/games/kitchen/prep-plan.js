import { STOCK_ITEMS } from './kitchen.js';

/** Quantities still needed across open orders; recipe order is checked by the model. */
export function prepPlan(stations, kitchen) {
    if (!kitchen) return [];
    const orders = stations.filter(station => station.phase === 'editing' && station.order && !station.order.closed);
    const live = job => job.phase !== 'empty' && job.phase !== 'burnt';
    return STOCK_ITEMS.map(ingredient => {
        let needed = 0, reserved = 0, retry = 0;
        for (const station of orders) {
            let plated = 0, pending = 0;
            for (const layer of station.layers) {
                if (layer.ingredient !== ingredient) continue;
                if (!layer.pending) {
                    plated++;
                    continue;
                }
                const job = kitchen.grill.find(pan => pan.targetOrderId === station.order.id && pan.targetLayerId === layer.id);
                if (job && live(job)) pending++;
                if (job && job.phase === 'burnt') retry++;
            }
            reserved += pending;
            needed += Math.max(0, (station.order.recipe.required[ingredient] || 0) - plated - pending);
        }
        const ready = kitchen.stock[ingredient];
        let cooking = 0;
        if (ingredient === 'patty') {
            cooking = kitchen.grill.filter(job => live(job) && job.targetOrderId === undefined && job.targetLayerId === undefined)
                .reduce((count, job) => count + (job.quantity === undefined ? 2 : job.quantity), 0);
        } else if (ingredient === 'lasagna') {
            cooking = live(kitchen.oven) ? 4 : 0;
        } else if (kitchen.board.ingredient === ingredient && kitchen.board.cuts > 0) {
            cooking = kitchen.board.batch;
        }
        return { ingredient, needed, ready, cooking, missing: Math.max(0, needed - ready - cooking), reserved, retry };
    }).filter(row => row.needed || row.reserved || row.retry || row.cooking);
}
