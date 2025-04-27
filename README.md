# Question Who

Game Link: https://spy-game-production-faa7.up.railway.app/

## Technologies

Made from scratch with **TypeScript** for the server and **JavaScript** for the client. (Runs with ts-node) 
Hosted in **Railway** using **NodeJS**.
Communicates with the players using **WebSockets**.
Used **SCSS** for styling.

## What is this project ?

This is a browser based online game you can play with your friends. The goal of the game is to find the spy among the players.
At the start of the game, everyone will get a question, but one random players question will be different from all the others, the crowd will need to guess the spy to get points.

## How to play ?

Firstly, you need to pick a username and a profile picture, then hop into the lobby (There is only one lobby).
Then, the questions will be entered by the admin, using the browser console (Will move it to a regular modal for mobile support).
After the question appears, the players will have one minute to write an answer and submit.
In the voting phase, players will vote for the one they think the spy is. 
After the voting phase ends, the spy, and the amount of votes every player got will be revealed.
If the crowd is correct, they get a point, if not the spy gets the points. 

## In-game screenshots

![image](https://github.com/user-attachments/assets/6f49fc19-2d52-4b81-8004-9517794308a3)
![image](https://github.com/user-attachments/assets/fbbbf932-25f7-4602-bda4-2502d2f0f245)
![image](https://github.com/user-attachments/assets/824405c4-cc49-41b5-b0f4-8cd3ad646f22)
![image](https://github.com/user-attachments/assets/17c9f4c8-2fac-4793-8cb6-016729cff1da)
![image](https://github.com/user-attachments/assets/d6db220e-0781-4e6e-b677-d1ba3f08da5e)

## Planned improvements

- Add more profile pictures
- Make a profile picture selecting modal, where all of them are visible at the same time for not toggling for long
- Translate some of the emojis to English and French
- The flags should change the language when pressed
- Make the buttons larger (generally)
- Show who didn't vote yet at the voting phase
- Show the spy's question at the end of the game
- Extra points for the people who successfully guessed the spy, minus points for those who didn't
- Pressing enter should send the answers
- Add emoji spamming like in google meet
- Add voice effects
- Page title should change according to the selected language
- Change the arrows so they are not so weird
- Dark mode
