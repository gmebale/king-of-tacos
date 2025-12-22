SELECT o.id, o.customer_name, o.total_amount, COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.customer_name, o.total_amount
ORDER BY o.created_date DESC
LIMIT 5;

SELECT oi.order_id, oi.product_name, oi.quantity, oi.price
FROM order_items oi
ORDER BY oi.order_id DESC
LIMIT 10;
