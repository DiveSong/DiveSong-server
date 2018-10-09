create database if not exists divesong;
use divesong;
create table users(
	uid			bigint primary key auto_increment,
	uname		varchar(255) unique,
	email		varchar(511) unique,
	fname		varchar(255),
	lname		varchar(255),
	everify		int
);

create table pass(
	uid			bigint primary key,
	passhash	varchar(257),
	salt		varchar(11),
	foreign key (uid) references users(uid)
);

create table albums(
	album_id	bigint primary key auto_increment,
	name		varchar(255) not null,
	rdate		date,
	num_tracks	int,
	check (num_tracks>0)
);

create table track(
	tid			bigint	primary key	auto_increment,
	name		varchar(255),
	tpath		varchar(511),
	album_id	bigint,
	artists		varchar(511),
	genre		varchar(255),
	lang		varchar(255),
	track_no	int,
	duration	bigint,
	bitrate		bigint,
	foreign key (album_id) references albums(album_id)
);
	
create table thistory(
	tid			bigint primary key,
	lplayed		datetime,
	foreign key (tid) references track(tid)
);	

create view search as select
	track.artists	as artists,
	track.genre		as genre,
	albums.name		as album_name,
	track.lang		as lang,
	track.name		as name
	from track left join albums 
	on track.album_id=albums.album_id;

create table req_list(
	rtime		datetime not null,
	tid			bigint not null,
	num_req		bigint,
	foreign key (tid) references track(tid),
	check (num_req > 0)
);

create table next_tracks(
	tid			bigint primary key,
	ind			int,
	foreign key (tid) references req_list(tid)
);

create table track_status(
    tid			bigint primary key,
	num_played	bigint,
	likes		bigint,
	dislikes	bigint,
	foreign key (tid) references track(tid)
);

create table uhistory(
	uid			bigint not null,
	to_oper		int not null,
	tid			bigint not null,
	odate		date,
	foreign key (tid) references track(tid),
	foreign key (uid) references users(uid),
	check (to_oper>=0 and to_oper<=2)
);

create table authenticate(
	uid			bigint not null,
	auth_token	varchar(511) not null,
	mac			varchar(255) not null,
	tme			datetime,
	foreign key	(uid) references users(uid)
);
	
	
	
	



