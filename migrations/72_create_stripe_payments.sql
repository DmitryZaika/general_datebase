create table stripe_payments (
    id binary(16) primary key default (uuid()),
    sale_id INT not null,
    stripe_payment_intent_id varchar(255) not null,
    amount_total int not null,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    constraint fk_stripe_payments_sale_id foreign key (sale_id) references sales(id)
);