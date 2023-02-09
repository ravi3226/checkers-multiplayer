# auth events

> ## register

- user:register -> emit
    
    ### payload
    
    ``` json
    {
     "email": "example@mail.com",
     "password": "strong@123#",
     "confirmPassword": "strong@123#"
    }
    
    ```
    
- user:register:success -> listen
- user:register:fail -> listen
    

---

> ## login

- user:login -> emit
    
    ### payload
    
    ``` json
    {
        "email": "example@mail.com",
        "password": "strong@123#"
    }
    
    ```
    
- user:login:success -> listen
- user:login:fail -> listen
    

---

> ## token refresh

- token:refresh -> emit
    
    ### payload
    
    ``` json
    {
        "token": ""
    }
    
    ```
    
- token:refresh:success -> listen
- token:refresh:fail -> listen

---

> ## game create

- game:create -> emit

    ### payload
    ```json
    {
        "token": "<Bearer token>"
    }
    ```

- game:create:success -> listen
- game:create:fail -> listen

---

> ## get possible move

- player:move-possible -> emit

    ### payload
    ```json
    {
        "token": "<Bearer token>",
        "gameId": "gameId (returned by event :: game:create:success)",
        "position": "A3"
    }
    ```

- player:move-possible:success -> listen
- player:move-possible:fail -> listen

---

> ## move player's tile position

- player:move -> emit

    ### payload
    ```json
    {
        "token": "<Bearer token>",
        "gameId": "gameId (returned by event :: game:create:success)",
        "from": "A3",
        "to": "B4"
    }
    ```

- player:move-possible:success -> listen
- player:move-possible:fail -> listen

---

> ## listen player turn

- player:turn -> listen

---

> ## listen for game over
- game:over:success -> listen
- game:over:fail -> listen (only for developer to understand the bug)