CREATE TABLE installed_stones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      stone_id INT,
    constraint fk_installed_stones_id foreign key (stone_id) references stones(id) 
);