create table main.sessions (
id CHAR (36) primary key,
user_id INT ,
expiration_date TIMESTAMP,
is_deleted BOOLEAN DEFAULT 0,
 created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 constraint fk_user_id foreign key (user_id) references users(id)
)
