# TODO: Fix Pricing Issue for Customized Products

## Problem
When customizing a product (adding supplements), the total price does not include the added supplements' costs.

## Root Cause
In Payment.jsx, the order items were using `item.product.displayPrice || item.product.price` instead of the calculated subtotal that includes customization costs.

## Changes Made
- [x] Updated Payment.jsx to use `item.subtotal / item.quantity` for the price when sending order items to backend
- [x] Updated Payment.jsx display to show `item.subtotal` instead of calculated price for each item

## Testing
- [ ] Test customizing a product with supplements
- [ ] Verify that the total price includes supplement costs
- [ ] Check that the order is created with correct pricing
