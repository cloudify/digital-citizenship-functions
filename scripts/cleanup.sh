#!/bin/bash

source ./variables.sh

##### CLEANUP

az functionapp delete -g $resourceGroupName -n $functionsName

az appservice plan delete --name $appService --resource-group $resourceGroupName --sku $appServiceSku

az storage account delete -y --name $storageName --resource-group $resourceGroupName

az cosmosdb delete --name $cosmosname --resource-group $resourceGroupName

# Alternative (better) cleanup procedure 
#   if you have got the rights:
# az group delete --name $resourceGroupName