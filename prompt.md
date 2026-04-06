I want to build a beginner-friendly web app. Please write a complete single-file index.html that I can paste directly into VS Code.

App purpose:
My company is a transportation engineering consulting firm. We are completing 30% design for a bus rapid transit corridor in Denver Colorado that’s. This project is called the Federal Blvd BRT corridor. Here is some more project information: https://www.codot.gov/projects/studies/denvermetrobrt/federalbrt. This app will be used internally to show stakeholders how parcels along the existing corridor will be impacted by construction easements. 
Data/API:
•	The ROW Impacts spreadsheet identifies all parcels along the corridor. The parcel number is in column A. The Impact Category is in Column B. 

•	The key dataset to use is the Colorado parcel map. I’ve identified this location in two sources, but there might be others too:
o	https://geodata.colorado.gov/datasets/COOIT::colorado-public-parcels/explore?location=39.470476%2C-105.129209%2C11&showTable=true
o	https://geodata.colorado.gov/maps/21bde4454fe943cb8a54a7b95cf10a77/explore?location=39.763483%2C-105.024069%2C18

•	Only the parcels in the spreadsheet need to be displayed. Do not display all parcels available in this dataset, it’s way too many

User workflow:
•	All identified parcels would be displayed in the web map. The user would hover their mouse over a specific parcel and the app would display information about the parcel detailed in the ROW Impacts spreadsheet
•	There should also be check boxes that allow the user to select what categories of parcels they want to see: all, high, medium, low, etc.

Requirements:
•	Use plain HTML/CSS/JavaScript
•	Follow the CDOT brand/logo guidelines https://www.codot.gov/assets/cdotbrandquickguide.pdf 
•	Keep it in one index.html file
•	Make it beginner-friendly
•	Include comments in the code
•	Use Mapbox for the map. An aerial imagery basemap should be used
•	Use a clean sidebar + map layout
•	Make it easy to modify later, there will likely be changes from our team
•	Follow other best practices identified in this project chat


As an output, give me the full code, not partial snippets.


