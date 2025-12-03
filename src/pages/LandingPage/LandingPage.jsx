import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import "./LandingPage.css";
function LandingPage(){
    const[view,setView]=useState("none");
    return(
        <div className="landing-container">
            <div className="hero-section">
                <h1>Dysarthric Speech Assessment Tool</h1>
                <p>Assess dysarthric speech efficiently with modern tools.</p>
                <div className="btn-group">
                    <button onClick={()=>setView("Login")}>Login</button>
                    <button onClick={()=>setView("Register")}>Register</button>
                </div>
            </div>
            <div className="form-section">
                {view==="Login" && <LoginForm /> }
                {view==="Register" && <RegisterForm />}
            </div>
        </div>
    );
}
export default LandingPage;