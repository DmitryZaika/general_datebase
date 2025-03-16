CREATE TABLE installed_sinks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sink_id INT,
    CONSTRAINT fk_installed_sinks_id FOREIGN KEY (sink_id) REFERENCES sinks(id) 
);
