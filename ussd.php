<?php

// Function to send a POST request to the Formspree endpoint
function sendToFormspree($data) {
    // Replace this with your actual Formspree endpoint URL
    $url = 'YOUR_FORMSPREE_ENDPOINT_URL';
    $options = array(
        'http' => array(
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data)
        )
    );
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    return $result;
}

// Read the variables sent via POST from the API
$sessionId   = $_POST["sessionId"];
$serviceCode = $_POST["serviceCode"];
$phoneNumber = $_POST["phoneNumber"];
$text        = $_POST["text"];

// Define the prices and names for each plan
$plans = [
    // MTN
    "1*1" => ["name" => "MTN 1GB", "cost" => "GHS 7.00"],
    "1*2" => ["name" => "MTN 2GB", "cost" => "GHS 11.00"],
    "1*3" => ["name" => "MTN 3GB", "cost" => "GHS 16.00"],
    "1*4" => ["name" => "MTN 4GB", "cost" => "GHS 22.00"],
    "1*5" => ["name" => "MTN 5GB", "cost" => "GHS 26.00"],
    "1*6" => ["name" => "MTN 6GB", "cost" => "GHS 31.00"],
    "1*7" => ["name" => "MTN 8GB", "cost" => "GHS 41.00"],
    "1*8" => ["name" => "MTN 10GB", "cost" => "GHS 50.00"],
    "1*9" => ["name" => "MTN 15GB", "cost" => "GHS 72.00"],
    "1*10" => ["name" => "MTN 20GB", "cost" => "GHS 90.00"],
    "1*11" => ["name" => "MTN 25GB", "cost" => "GHS 110.00"],
    "1*12" => ["name" => "MTN 30GB", "cost" => "GHS 135.00"],
    "1*13" => ["name" => "MTN 40GB", "cost" => "GHS 173.00"],
    "1*14" => ["name" => "MTN 50GB", "cost" => "GHS 212.00"],
    
    // AT
    "2*1" => ["name" => "AT 1GB", "cost" => "GHS 6.00"],
    "2*2" => ["name" => "AT 2GB", "cost" => "GHS 10.00"],
    "2*3" => ["name" => "AT 3GB", "cost" => "GHS 14.00"],
    "2*4" => ["name" => "AT 4GB", "cost" => "GHS 18.00"],
    "2*5" => ["name" => "AT 5GB", "cost" => "GHS 22.00"],
    "2*6" => ["name" => "AT 6GB", "cost" => "GHS 26.00"],
    "2*7" => ["name" => "AT 8GB", "cost" => "GHS 34.00"],
    "2*8" => ["name" => "AT 10GB", "cost" => "GHS 42.00"],
    "2*9" => ["name" => "AT 12GB", "cost" => "GHS 49.00"],
    
    // Telecel
    "3*1" => ["name" => "Telecel 5GB", "cost" => "GHS 26.00"],
    "3*2" => ["name" => "Telecel 10GB", "cost" => "GHS 46.00"],
    "3*3" => ["name" => "Telecel 20GB", "cost" => "GHS 81.00"],
    "3*4" => ["name" => "Telecel 30GB", "cost" => "GHS 116.00"],
    "3*5" => ["name" => "Telecel 40GB", "cost" => "GHS 156.00"]
];

$response = "";

if ($text == "") {
    // This is the first request. Note how we start the response with CON
    $response  = "CON Welcome to Bangerhitz Digital Media. Select a network:\n";
    $response .= "1. MTN\n";
    $response .= "2. AT\n";
    $response .= "3. Telecel";

} else if (substr($text, 0, 1) == "1") {
    // User selected MTN
    $textParts = explode("*", $text);
    if (count($textParts) == 1) {
        $response  = "CON MTN Bundles:\n";
        $response .= "1. 1GB - GHC 7.00\n";
        $response .= "2. 2GB - GHC 11.00\n";
        $response .= "3. 3GB - GHC 16.00\n";
        $response .= "4. 4GB - GHC 22.00\n";
        $response .= "5. 5GB - GHC 26.00\n";
        $response .= "6. 6GB - GHC 31.00\n";
        $response .= "7. 8GB - GHC 41.00\n";
        $response .= "8. 10GB - GHC 50.00\n";
        $response .= "9. 15GB - GHC 72.00\n";
        $response .= "10. 20GB - GHC 90.00\n";
        $response .= "11. 25GB - GHC 110.00\n";
        $response .= "12. 30GB - GHC 135.00\n";
        $response .= "13. 40GB - GHC 173.00\n";
        $response .= "14. 50GB - GHC 212.00";
    } else {
        // User is selecting a specific MTN plan
        $selectedPlanCode = $text;
        if (array_key_exists($selectedPlanCode, $plans)) {
            $plan = $plans[$selectedPlanCode];
            $response = "CON You have selected the {$plan['name']} plan for {$plan['cost']}. Confirm purchase:\n";
            $response .= "1. Confirm";
        } else {
            $response = "END Invalid input. Please try again.";
        }
    }

} else if (substr($text, 0, 1) == "2") {
    // User selected AT
    $textParts = explode("*", $text);
    if (count($textParts) == 1) {
        $response  = "CON AT Bundles:\n";
        $response .= "1. 1GB - GHC 6.00\n";
        $response .= "2. 2GB - GHC 10.00\n";
        $response .= "3. 3GB - GHC 14.00\n";
        $response .= "4. 4GB - GHC 18.00\n";
        $response .= "5. 5GB - GHC 22.00\n";
        $response .= "6. 6GB - GHC 26.00\n";
        $response .= "7. 8GB - GHC 34.00\n";
        $response .= "8. 10GB - GHC 42.00\n";
        $response .= "9. 12GB - GHC 49.00";
    } else {
        $selectedPlanCode = $text;
        if (array_key_exists($selectedPlanCode, $plans)) {
            $plan = $plans[$selectedPlanCode];
            $response = "CON You have selected the {$plan['name']} plan for {$plan['cost']}. Confirm purchase:\n";
            $response .= "1. Confirm";
        } else {
            $response = "END Invalid input. Please try again.";
        }
    }

} else if (substr($text, 0, 1) == "3") {
    // User selected Telecel
    $textParts = explode("*", $text);
    if (count($textParts) == 1) {
        $response  = "CON Telecel Bundles:\n";
        $response .= "1. 5GB - GHC 26.00\n";
        $response .= "2. 10GB - GHC 46.00\n";
        $response .= "3. 20GB - GHC 81.00\n";
        $response .= "4. 30GB - GHC 116.00\n";
        $response .= "5. 40GB - GHC 156.00";
    } else {
        $selectedPlanCode = $text;
        if (array_key_exists($selectedPlanCode, $plans)) {
            $plan = $plans[$selectedPlanCode];
            $response = "CON You have selected the {$plan['name']} plan for {$plan['cost']}. Confirm purchase:\n";
            $response .= "1. Confirm";
        } else {
            $response = "END Invalid input. Please try again.";
        }
    }

} else if (strpos($text, "*1") !== false) {
    // User confirmed a purchase from any network
    $selectedPlanCode = substr($text, 0, -2);
    $plan = $plans[$selectedPlanCode];

    // Create a data array to send to Formspree
    $dataToSend = array(
        'plan' => $plan['name'],
        'phoneNumber' => $phoneNumber,
        'cost' => $plan['cost'],
        'source' => 'USSD',
        'status' => 'Pending Payment'
    );
    
    // Send the data to your Formspree endpoint
    sendToFormspree($dataToSend);

    // This is a terminal request. The USSD session ends here.
    $response = "END Thank you! Please pay {$plan['cost']} for your {$plan['name']} bundle by sending a Mobile Money transfer to Bangerhitz Digital Media on 0205306718. Your request will be fulfilled after payment confirmation.";

} else {
    $response = "END Invalid input. Please try again.";
}

// Echo the response back to the API
header('Content-type: text/plain');
echo $response;

?>
