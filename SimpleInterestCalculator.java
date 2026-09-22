public class SimpleInterestCalculator {
    public static void main(String[] args) {
        // Declare and initialize variables
        double principal = 50000.0;
        double rate = 5.5;
        int time = 3;
        
        // Perform the calculation
        double simpleInterest = (principal * rate * time) / 100;
        
        // Print the results to the screen
        System.out.println("Principal: " + principal);
        System.out.println("Rate: " + rate + "%");
        System.out.println("Time: " + time + " years");
        System.out.println("Simple Interest: " + simpleInterest);
    }
}
