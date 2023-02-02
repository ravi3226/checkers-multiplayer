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