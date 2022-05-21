# Create Database
CREATE DATABASE IF NOT EXISTS rtss;

# Create User
CREATE USER 'rtss'@'%' IDENTIFIED BY 'password';
CREATE USER 'rtss'@'localhost' IDENTIFIED BY 'password';

# Give permission to the user for accessing the database
GRANT ALL PRIVILEGES ON rtss.* TO 'rtss'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON rtss.* TO 'rtss'@'localhost' WITH GRANT OPTION;

# Use the Database
USE rtss;

# Insert accounts table
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `chairo` bool NOT NULL,
  `controller` bool NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

# Insert User into accounts
INSERT INTO `accounts` (`username`, `password`, `email`, `chairo`, `controller`) VALUES ('username', 'password', 'email@gmail.com', true, true);


# Other commands:

# List all valules in table
SELECT * FROM accounts;

# Show all databases
SHOW DATABASE;

# Change user password identified to mysql_native_password (MySQL only)
ALTER USER 'rtss'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';

# Delete database
DROP DATABASE rtss;

# Delete table
DROP TABLE accounts;

# Delete user
DROP USER 'rtss'@'localhost';